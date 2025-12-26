import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Query } from "@medusajs/framework/types"

export const AUTHENTICATE = true

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}
function normalizePhone(raw?: string | null) {
  const digits = String(raw || "").replace(/\D/g, "")
  return digits.length >= 10 ? digits.slice(-15) : null
}

function requireDestinationPhone(order: any) {
  const fromShipping = normalizePhone(order?.shipping_address?.phone)
  if (fromShipping) return fromShipping

  const fromCustomer = normalizePhone(order?.customer?.phone)
  if (fromCustomer) return fromCustomer

  return null
}
async function freightcomRequest(path: string, opts?: { method?: string; body?: any }) {
  const base = requireEnv("FREIGHTCOM_API_BASE_URL")
  const key = requireEnv("FREIGHTCOM_API_KEY")
  const url = `${base}${path}`

  const method = opts?.method || "GET"
  const body = opts?.body ? JSON.stringify(opts.body, null, 2) : undefined

  console.log("📦 Freightcom REQUEST", {
    url,
    method,
    headers: { "Content-Type": "application/json", Authorization: "[REDACTED]" },
    body: opts?.body,
  })

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: key },
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
    console.error("❌ Freightcom RESPONSE", { status: res.status, statusText: res.statusText, body: json ?? text })
    throw new Error(`Freightcom ${res.status}: ${JSON.stringify(json ?? { raw: text })}`)
  }

  console.log("✅ Freightcom RESPONSE", json ?? text)
  return json ?? { raw: text }
}

// --- package builder (same defaults) ---
type PackageOverrides = {
  unit_system?: "metric" | "imperial"
  default_weight_g?: number
  default_l_cm?: number
  default_w_cm?: number
  default_h_cm?: number
}

function gToLb(g: number) { return g / 453.59237 }
function gToKg(g: number) { return g / 1000 }
function cmToIn(cm: number) { return cm / 2.54 }
function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10) / 10 }

function buildPackages(order: any, overrides?: PackageOverrides) {
  const unitSystem: "metric" | "imperial" = overrides?.unit_system || "imperial"

  const DEFAULT_WEIGHT_G = Number(overrides?.default_weight_g ?? process.env.DEFAULT_ITEM_WEIGHT_G ?? 500)
  const DEFAULT_L_CM = Number(overrides?.default_l_cm ?? process.env.DEFAULT_ITEM_LENGTH_CM ?? 20)
  const DEFAULT_W_CM = Number(overrides?.default_w_cm ?? process.env.DEFAULT_ITEM_WIDTH_CM ?? 15)
  const DEFAULT_H_CM = Number(overrides?.default_h_cm ?? process.env.DEFAULT_ITEM_HEIGHT_CM ?? 10)

  const packages: any[] = []

  for (const item of order.items || []) {
    const qty = Math.max(1, Number(item.quantity || 1))
    const v = item.variant || {}

    const w = Number(v.weight)
    const l = Number(v.length)
    const wi = Number(v.width)
    const h = Number(v.height)

    const hasAll =
      Number.isFinite(w) && w > 0 &&
      Number.isFinite(l) && l > 0 &&
      Number.isFinite(wi) && wi > 0 &&
      Number.isFinite(h) && h > 0

    const weightG = hasAll ? w : DEFAULT_WEIGHT_G
    const Lcm = hasAll ? l : DEFAULT_L_CM
    const Wcm = hasAll ? wi : DEFAULT_W_CM
    const Hcm = hasAll ? h : DEFAULT_H_CM

    for (let i = 0; i < qty; i++) {
      packages.push(
        unitSystem === "metric"
          ? {
              description: item.title || "Package",
              measurements: {
                weight: { unit: "kg", value: Math.max(0.01, round2(gToKg(weightG))) },
                cuboid: { unit: "cm", l: Math.max(0.1, round1(Lcm)), w: Math.max(0.1, round1(Wcm)), h: Math.max(0.1, round1(Hcm)) },
              },
            }
          : {
              description: item.title || "Package",
              measurements: {
                weight: { unit: "lb", value: Math.max(0.01, round2(gToLb(weightG))) },
                cuboid: { unit: "in", l: Math.max(0.1, round1(cmToIn(Lcm))), w: Math.max(0.1, round1(cmToIn(Wcm))), h: Math.max(0.1, round1(cmToIn(Hcm))) },
              },
            }
      )
    }
  }

  return packages.length
    ? packages
    : [
        unitSystem === "metric"
          ? {
              description: "Default package",
              measurements: {
                weight: { unit: "kg", value: Math.max(0.01, round2(gToKg(DEFAULT_WEIGHT_G))) },
                cuboid: { unit: "cm", l: round1(DEFAULT_L_CM), w: round1(DEFAULT_W_CM), h: round1(DEFAULT_H_CM) },
              },
            }
          : {
              description: "Default package",
              measurements: {
                weight: { unit: "lb", value: Math.max(0.01, round2(gToLb(DEFAULT_WEIGHT_G))) },
                cuboid: { unit: "in", l: round1(cmToIn(DEFAULT_L_CM)), w: round1(cmToIn(DEFAULT_W_CM)), h: round1(cmToIn(DEFAULT_H_CM)) },
              },
            },
      ]
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id

    const {
      service_id,
      payment_method_id,
      expected_ship_date,
      package_overrides,
      unique_id,
      customs_and_duties_payment_method_id,
    } = (req.body || {}) as {
      service_id: string
      payment_method_id: string
      customs_and_duties_payment_method_id?: string
      expected_ship_date: { year: number; month: number; day: number }
      package_overrides?: PackageOverrides
      unique_id?: string
    }

    if (!service_id) return res.status(400).json({ message: "Missing service_id" })
    if (!payment_method_id) return res.status(400).json({ message: "Missing payment_method_id" })
    if (!expected_ship_date?.year) return res.status(400).json({ message: "Missing expected_ship_date" })

    const query = req.scope.resolve<Query>("query")
    const { data } = await query.graph({
      entity: "order",
fields: [
  "id",
  "email",

  "customer.phone",

  "shipping_address.phone",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.country_code",
  "shipping_address.postal_code",
  "shipping_address.company",

  "items.title",
  "items.quantity",
  "items.variant.weight",
  "items.variant.length",
  "items.variant.width",
  "items.variant.height",
],
      filters: { id: orderId },
    })

    const order = data?.[0]
    if (!order) return res.status(404).json({ message: "Order not found" })
const destinationPhone = requireDestinationPhone(order)

if (!destinationPhone) {
  return res.status(400).json({
    message:
      "Customer phone number is required to book shipment. Please add a phone number to the customer or shipping address.",
    code: "DESTINATION_PHONE_REQUIRED",
  })
}
    const ship = order.shipping_address
    if (!ship?.postal_code || !ship?.country_code) {
      return res.status(400).json({ message: "Order shipping address missing postal code / country." })
    }

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
        phone_number:{
            number:"9023064110"
        },
                contact_name:"Bioteem Warehouse",
      residential: true,
      email_addresses: [process.env.WAREHOUSE_EMAIL || "sales@bioteem40.ca"],
      receives_email_updates: true,
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
  phone_number: {
    number: destinationPhone,
  },
  contact_name: `${ship.first_name || ""} ${ship.last_name || ""}`.trim() || "Customer",
  residential: true,
  email_addresses: order.email ? [order.email] : [],
  receives_email_updates: true,
}

    const packages = buildPackages(order, package_overrides)

    const bookBody = {
      unique_id: unique_id || `order_${orderId}_${Date.now()}`,
      payment_method_id,
      customs_and_duties_payment_method_id,
      service_id,
      details: {
        origin,
        destination,
        expected_ship_date,
        packaging_type: "package",
        packaging_properties: { packages },
      },
    }

    const path = process.env.FREIGHTCOM_BOOK_PATH || "/shipment"
    const booked = await freightcomRequest(path, { method: "POST", body: bookBody })

    return res.status(200).json({ booked })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Unknown error" })
  }
}