import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService } from "@medusajs/framework/types"

export const AUTHENTICATE = true

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function freightcomRequest(path: string, opts?: { method?: string; body?: any }) {
  const base = requireEnv("FREIGHTCOM_API_BASE_URL") // e.g. https://external-api.freightcom.com
  const key = requireEnv("FREIGHTCOM_API_KEY")

  const res = await fetch(`${base}${path}`, {
    method: opts?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: key,
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  })

  const text = await res.text().catch(() => "")
  if (!res.ok) {
    throw new Error(`Freightcom ${res.status}: ${text || res.statusText}`)
  }

  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}

function buildParcelsFromOrder(order: any) {
  const DEFAULT_WEIGHT_G = Number(process.env.DEFAULT_ITEM_WEIGHT_G || 500) // 500g
  const DEFAULT_L_CM = Number(process.env.DEFAULT_ITEM_LENGTH_CM || 20)
  const DEFAULT_W_CM = Number(process.env.DEFAULT_ITEM_WIDTH_CM || 15)
  const DEFAULT_H_CM = Number(process.env.DEFAULT_ITEM_HEIGHT_CM || 10)

  const parcels: any[] = []

  for (const item of order.items || []) {
    const qty = Math.max(1, Number(item.quantity || 1))
    const v = item.variant || {}

    // Medusa variant shipping fields (what the admin “Shipping” widget edits)
    const weightG = Number.isFinite(Number(v.weight)) ? Number(v.weight) : DEFAULT_WEIGHT_G
    const L = Number.isFinite(Number(v.length)) ? Number(v.length) : DEFAULT_L_CM
    const W = Number.isFinite(Number(v.width)) ? Number(v.width) : DEFAULT_W_CM
    const H = Number.isFinite(Number(v.height)) ? Number(v.height) : DEFAULT_H_CM

    for (let i = 0; i < qty; i++) {
      parcels.push({
        weight: { value: weightG / 1000, unit: "kg" }, // g -> kg
        dimensions: { length: L, width: W, height: H, unit: "cm" },
        description: item.title || "Item",
      })
    }
  }

  if (parcels.length === 0) {
    parcels.push({
      weight: { value: DEFAULT_WEIGHT_G / 1000, unit: "kg" },
      dimensions: { length: DEFAULT_L_CM, width: DEFAULT_W_CM, height: DEFAULT_H_CM, unit: "cm" },
      description: "Default parcel",
    })
  }

  return parcels
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)

  // ✅ Medusa v2: USE fields (not relations)
const order = await orderService.retrieveOrder(orderId, {
  select: [
    "id",
    "email",
    "shipping_address_id",
    // item + variant fields you actually need
  ],
  relations: [
    "shipping_address",
    "items",
    "items.variant",
  ],
})

  const ship = order.shipping_address
  if (!ship?.postal_code || !ship?.country_code) {
    return res.status(400).json({
      message: "Order shipping address missing postal code / country.",
    })
  }

  const parcels = buildParcelsFromOrder(order)

  const origin = {
    name: "Warehouse",
    address: {
      address_line_1: "",
      address_line_2: process.env.WAREHOUSE_ADDR2 || "",
      unit_number: process.env.WAREHOUSE_UNIT || "",
      city: requireEnv("WAREHOUSE_CITY"),
      region: requireEnv("WAREHOUSE_REGION"),
      country: requireEnv("WAREHOUSE_COUNTRY"),
      postal_code: requireEnv("WAREHOUSE_POSTAL"),
    },
    residential: true,
    email_addresses: [process.env.WAREHOUSE_EMAIL || "sales@bioteem40.ca"],
    receives_email_updates: false,
  }

  const destination = {
    name: `${ship.first_name || ""} ${ship.last_name || ""}`.trim() || "Customer",
    address: {
      address_line_1: ship.address_1 || "",
      address_line_2: ship.address_2 || "",
      unit_number: ship.company || "",
      city: ship.city || "",
      region: ship.province || "",
      country: (ship.country_code || "").toUpperCase(),
      postal_code: ship.postal_code || "",
    },
    residential: true,
    email_addresses: order.email ? [order.email] : [],
    receives_email_updates: true,
  }

  const payload = {
    details: {
      origin,
      destination,
      parcels,
    },
  }

  // Create rate request
  const created = await freightcomRequest("/rate", { method: "POST", body: payload })
  const rate_id = created?.rate_id
  if (!rate_id) {
    return res.status(502).json({
      message: "Freightcom did not return rate_id.",
      raw: created,
    })
  }

  // Poll
  const pollMs = Number(process.env.FREIGHTCOM_RATE_POLL_MS || 800)
  const pollMax = Number(process.env.FREIGHTCOM_RATE_POLL_MAX || 12)

  let last: any = null
  for (let i = 0; i < pollMax; i++) {
    await sleep(pollMs)
    last = await freightcomRequest(`/rate/${rate_id}`)
    if (Array.isArray(last?.rates)) {
      return res.json({ rate_id, rates: last.rates })
    }
  }

  // Still processing
  return res.status(202).json({ rate_id })
}
