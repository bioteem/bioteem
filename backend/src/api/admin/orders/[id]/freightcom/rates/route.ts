import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService } from "@medusajs/framework/types"

type FreightcomRateCreateResponse = { rate_id: string }
type FreightcomRateGetResponse = { rates?: any[]; status?: string; message?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function freightcomFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const base = process.env.FREIGHTCOM_API_BASE_URL || "https://external-api.freightcom.com"
  const apiKey = process.env.FREIGHTCOM_API_KEY
  if (!apiKey) throw new Error("Missing FREIGHTCOM_API_KEY")

  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey, // your key header approach
      ...(opts.headers || {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Freightcom ${res.status}: ${text || res.statusText}`)
  }

  return (await res.json()) as T
}

// ---- Packing helpers ----

function num(x: any): number | null {
  const n = typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN
  return Number.isFinite(n) ? n : null
}

function getVariantShippingMeta(variant: any) {
  const md = variant?.metadata || {}

  const weight_kg = num(md.weight_kg)
  const length_cm = num(md.length_cm)
  const width_cm = num(md.width_cm)
  const height_cm = num(md.height_cm)

  return { weight_kg, length_cm, width_cm, height_cm }
}

/**
 * Simple packing strategy:
 * - Creates one parcel per line item *quantity* using variant metadata.
 * - Later you can upgrade this to box-packing / consolidation.
 */
function buildParcelsFromOrderItems(order: any) {
  const DEFAULT_WEIGHT_G = Number(process.env.DEFAULT_ITEM_WEIGHT_G || 500) // 500g
  const DEFAULT_L_CM = Number(process.env.DEFAULT_ITEM_LENGTH_CM || 20)
  const DEFAULT_W_CM = Number(process.env.DEFAULT_ITEM_WIDTH_CM || 15)
  const DEFAULT_H_CM = Number(process.env.DEFAULT_ITEM_HEIGHT_CM || 10)

  const parcels: any[] = []

  const items = order?.items || []
  for (const item of items) {
    const qty = Math.max(1, Number(item?.quantity || 1))
    const v = item?.variant

    // Built-in Medusa variant fields (from the shipping widget)
    const weightG = Number.isFinite(Number(v?.weight)) ? Number(v.weight) : DEFAULT_WEIGHT_G
    const L = Number.isFinite(Number(v?.length)) ? Number(v.length) : DEFAULT_L_CM
    const W = Number.isFinite(Number(v?.width)) ? Number(v.width) : DEFAULT_W_CM
    const H = Number.isFinite(Number(v?.height)) ? Number(v.height) : DEFAULT_H_CM

    // Simple approach: one parcel per unit (predictable)
    for (let i = 0; i < qty; i++) {
      parcels.push({
        weight: { value: weightG / 1000, unit: "kg" }, // convert g -> kg
        dimensions: { length: L, width: W, height: H, unit: "cm" },
        description: item?.title || "Item",
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


function buildRatePayloadFromOrder(order: any) {
  const ship = order?.shipping_address
  if (!ship) throw new Error("Order has no shipping address")
  if (!ship.postal_code || !ship.country_code) {
    throw new Error("Order shipping address missing postal code / country")
  }

  // Origin = your warehouse (env-driven)
  const origin = {
    name: "Warehouse",
    address: {
      address_line_1: process.env.WAREHOUSE_ADDR1 || "200 University Avenue West",
      address_line_2: process.env.WAREHOUSE_ADDR2 || "",
      unit_number: process.env.WAREHOUSE_UNIT || "",
      city: process.env.WAREHOUSE_CITY || "Waterloo",
      region: process.env.WAREHOUSE_REGION || "ON",
      country: process.env.WAREHOUSE_COUNTRY || "CA",
      postal_code: process.env.WAREHOUSE_POSTAL || "N2L 3G1",
    },
    residential: false,
    email_addresses: [process.env.WAREHOUSE_EMAIL || "ops@example.com"],
    receives_email_updates: false,
  }

  // ✅ Destination = order shipping address
  const destination = {
    name: `${ship.first_name || ""} ${ship.last_name || ""}`.trim() || "Customer",
    address: {
      address_line_1: ship.address_1 || "",
      address_line_2: ship.address_2 || "",
      unit_number: ship.company || "",
      city: ship.city || "",
      region: ship.province || ship.region || "",
      country: (ship.country_code || "").toUpperCase(),
      postal_code: ship.postal_code || "",
    },
    residential: true,
    email_addresses: order?.email ? [order.email] : [],
    receives_email_updates: true,
  }

  // ✅ Parcel details from the products/variants on the order
  const parcels = buildParcelsFromOrderItems(order)

  return {
    details: {
      origin,
      destination,
      parcels,
    },
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)

  // IMPORTANT: pull items + variants + shipping address
  const order = await orderService.retrieveOrder(orderId, {
relations: ["shipping_address", "items", "items.variant"]
  })

  const payload = buildRatePayloadFromOrder(order)

  // Create rate request
  const created = await freightcomFetch<FreightcomRateCreateResponse>("/rate", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  const pollMs = Number(process.env.FREIGHTCOM_RATE_POLL_MS || 800)
  const pollMax = Number(process.env.FREIGHTCOM_RATE_POLL_MAX || 12)

  let last: FreightcomRateGetResponse | null = null
  for (let i = 0; i < pollMax; i++) {
    await sleep(pollMs)
    last = await freightcomFetch<FreightcomRateGetResponse>(`/rate/${created.rate_id}`, {
      method: "GET",
    })

    if (Array.isArray(last.rates)) {
      return res.json({ rate_id: created.rate_id, rates: last.rates })
    }
  }

  return res.status(202).json({
    rate_id: created.rate_id,
    status: last?.status || "processing",
    message: last?.message || "Rates not ready yet, try again.",
  })
}
