import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { Query } from "@medusajs/framework/types"

export const AUTHENTICATE = true

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}
function getExpectedShipDate() {
  const d = new Date()

  // After 4pm → start from next day
  if (d.getHours() >= 16) {
    d.setDate(d.getDate() + 1)
  }

  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1)
  }

  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  }
}

async function freightcomRequest(
  path: string,
  opts?: { method?: string; body?: any }
) {
  const base = requireEnv("FREIGHTCOM_API_BASE_URL")
  const key = requireEnv("FREIGHTCOM_API_KEY")

  const url = `${base}${path}`
  const method = opts?.method || "GET"
  const body = opts?.body ? JSON.stringify(opts.body, null, 2) : undefined

  // 🔍 LOG OUTGOING REQUEST (THIS IS WHAT WE NEED)
  console.log("📦 Freightcom REQUEST", {
    url,
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "[REDACTED]",
    },
    body: opts?.body,
  })

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: key,
    },
    body,
  })

  const text = await res.text().catch(() => "")

  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    console.error("❌ Freightcom RESPONSE", {
      status: res.status,
      statusText: res.statusText,
      body: json ?? text,
    })

    throw new Error(
      `Freightcom ${res.status}: ${JSON.stringify(json ?? { raw: text })}`
    )
  }

  console.log("✅ Freightcom RESPONSE", json ?? text)

  return json ?? { raw: text }
}


function round2(n: number) {
  return Math.round(n * 100) / 100
}
function round1(n: number) {
  return Math.round(n * 10) / 10
}
function gToLb(g: number) {
  return g / 453.59237
}
function cmToIn(cm: number) {
  return cm / 2.54
}

function buildFreightcomPackages(order: any) {
  const DEFAULT_WEIGHT_G = Number(process.env.DEFAULT_ITEM_WEIGHT_G || 500)
  const DEFAULT_L_CM = Number(process.env.DEFAULT_ITEM_LENGTH_CM || 20)
  const DEFAULT_W_CM = Number(process.env.DEFAULT_ITEM_WIDTH_CM || 15)
  const DEFAULT_H_CM = Number(process.env.DEFAULT_ITEM_HEIGHT_CM || 10)

  const packages: any[] = []

  for (const item of order.items || []) {
    const qty = Math.max(1, Number(item.quantity || 1))
    const v = item.variant || {}

    const weightG = Number.isFinite(Number(v.weight)) ? Number(v.weight) : DEFAULT_WEIGHT_G
    const Lcm = Number.isFinite(Number(v.length)) ? Number(v.length) : DEFAULT_L_CM
    const Wcm = Number.isFinite(Number(v.width)) ? Number(v.width) : DEFAULT_W_CM
    const Hcm = Number.isFinite(Number(v.height)) ? Number(v.height) : DEFAULT_H_CM

    const weightLb = Math.max(0.01, round2(gToLb(weightG)))
    const Lin = Math.max(0.1, round1(cmToIn(Lcm)))
    const Win = Math.max(0.1, round1(cmToIn(Wcm)))
    const Hin = Math.max(0.1, round1(cmToIn(Hcm)))

    for (let i = 0; i < qty; i++) {
      packages.push({
        description: item.title || "Package",
        measurements: {
          weight: { unit: "lb", value: weightLb },
          cuboid: { unit: "in", l: Lin, w: Win, h: Hin },
        },
      })
    }
  }

  // Fallback (shouldn't happen, but safe)
  if (packages.length === 0) {
    packages.push({
      description: "Default package",
      measurements: {
        weight: { unit: "lb", value: round2(gToLb(DEFAULT_WEIGHT_G)) },
        cuboid: {
          unit: "in",
          l: round1(cmToIn(DEFAULT_L_CM)),
          w: round1(cmToIn(DEFAULT_W_CM)),
          h: round1(cmToIn(DEFAULT_H_CM)),
        },
      },
    })
  }

  return packages
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try{
  const orderId = req.params.id
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)

  // ✅ Medusa v2: use fields (explicit), NOT select/relations
const query = req.scope.resolve<Query>("query")

const { data } = await query.graph({
  entity: "order",
  fields: [
    "id",
    "email",

    // shipping address
    "shipping_address.first_name",
    "shipping_address.last_name",
    "shipping_address.address_1",
    "shipping_address.address_2",
    "shipping_address.city",
    "shipping_address.province",
    "shipping_address.country_code",
    "shipping_address.postal_code",
    "shipping_address.company",

    // items
    "items.title",
    "items.quantity",

    // variant shipping fields
    "items.variant.weight",
    "items.variant.length",
    "items.variant.width",
    "items.variant.height",
  ],
  filters: {
    id: orderId,
  },
})

const order = data?.[0]
if (!order) {
  return res.status(404).json({ message: "Order not found" })
}


  const ship = order.shipping_address
  if (!ship?.postal_code || !ship?.country_code) {
    return res.status(400).json({
      message: "Order shipping address missing postal code / country.",
    })
  }


  // NOTE: most carrier APIs want ISO country + region codes (CA, NS, etc.)
  // If Freightcom needs full names you can revert, but this is safer.
  const origin = {
    name: "Warehouse",
    address: {
      address_line_1: "Centennial Drive",
      address_line_2: "",
      unit_number: "93",
      city: "Windsor",
      region: "NS",
      country: "CA",
      postal_code: "B0N2T0",
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
    expected_ship_date: getExpectedShipDate(), // jsonDate
    packaging_type: "package", // or env var
    packaging_properties: {
      packages: buildFreightcomPackages(order),
    },
  },
}


  const created = await freightcomRequest("/rate", { method: "POST", body: payload })
  const rate_id = created?.rate_id

  if (!rate_id) {
    return res.status(502).json({
      message: "Freightcom did not return rate_id.",
      raw: created,
    })
  }

  const pollMs = Number(process.env.FREIGHTCOM_RATE_POLL_MS || 800)
  const pollMax = Number(process.env.FREIGHTCOM_RATE_POLL_MAX || 12)

  for (let i = 0; i < pollMax; i++) {
    await sleep(pollMs)
    const result = await freightcomRequest(`/rate/${rate_id}`)
    if (Array.isArray(result?.rates)) {
      return res.json({ rate_id, rates: result.rates })
    }
  }
  
  return res.status(202).json({ rate_id })
 } catch (e: any) {
    return res.status(500).json({
      message: e?.message || "Unknown error",
    })
  }
}
