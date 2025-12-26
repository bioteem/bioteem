import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
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
  if (d.getHours() >= 16) d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
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

// ---------- units + conversions ----------
function gToLb(g: number) { return g / 453.59237 }
function gToKg(g: number) { return g / 1000 }
function cmToIn(cm: number) { return cm / 2.54 }
function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10) / 10 }

type PackageOverrides = {
  unit_system?: "metric" | "imperial" // metric => cm/kg, imperial => in/lb
  default_weight_g?: number
  default_l_cm?: number
  default_w_cm?: number
  default_h_cm?: number
}

function buildFreightcomPackages(order: any, overrides?: PackageOverrides) {
  const unitSystem: "metric" | "imperial" = overrides?.unit_system || "imperial"

  const DEFAULT_WEIGHT_G = Number(overrides?.default_weight_g ?? process.env.DEFAULT_ITEM_WEIGHT_G ?? 500)
  const DEFAULT_L_CM = Number(overrides?.default_l_cm ?? process.env.DEFAULT_ITEM_LENGTH_CM ?? 20)
  const DEFAULT_W_CM = Number(overrides?.default_w_cm ?? process.env.DEFAULT_ITEM_WIDTH_CM ?? 15)
  const DEFAULT_H_CM = Number(overrides?.default_h_cm ?? process.env.DEFAULT_ITEM_HEIGHT_CM ?? 10)

  const packages: any[] = []
  const debug = { total_items: 0, used_defaults_for: 0, sum_weight_g: 0 }

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

    if (!hasAll) debug.used_defaults_for += qty

    for (let i = 0; i < qty; i++) {
      debug.total_items += 1
      debug.sum_weight_g += weightG

      if (unitSystem === "metric") {
        packages.push({
          description: item.title || "Package",
          measurements: {
            weight: { unit: "kg", value: Math.max(0.01, round2(gToKg(weightG))) },
            cuboid: { unit: "cm", l: Math.max(0.1, round1(Lcm)), w: Math.max(0.1, round1(Wcm)), h: Math.max(0.1, round1(Hcm)) },
          },
        })
      } else {
        packages.push({
          description: item.title || "Package",
          measurements: {
            weight: { unit: "lb", value: Math.max(0.01, round2(gToLb(weightG))) },
            cuboid: { unit: "in", l: Math.max(0.1, round1(cmToIn(Lcm))), w: Math.max(0.1, round1(cmToIn(Wcm))), h: Math.max(0.1, round1(cmToIn(Hcm))) },
          },
        })
      }
    }
  }

  if (packages.length === 0) {
    const fallback = unitSystem === "metric"
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
        }
    packages.push(fallback)
  }

  return {
    packages,
    debug,
    defaults: { DEFAULT_WEIGHT_G, DEFAULT_L_CM, DEFAULT_W_CM, DEFAULT_H_CM, unitSystem },
  }
}

// ---------- rates paging (10 only + cursor offset) ----------
type FreightcomRate = {
  service_id: string
  total?: { value: string; currency: string }
  carrier_name?: string
  service_name?: string
  transit_time_days?: number
  transit_time_not_available?: boolean
  valid_until?: { year: number; month: number; day: number }
  surcharges?: Array<{ type: string; amount?: { value: string; currency: string } }>
  taxes?: Array<{ type: string; amount?: { value: string; currency: string } }>
  paperless?: boolean
  [k: string]: any
}

function centsValue(rate: FreightcomRate) {
  const n = Number(rate?.total?.value ?? NaN)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}
function transitDays(rate: FreightcomRate) {
  if (rate.transit_time_not_available) return Number.POSITIVE_INFINITY
  const n = Number(rate.transit_time_days ?? NaN)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

function smartMasterSort(all: FreightcomRate[]) {
  return [...all].sort((a, b) => {
    const ad = transitDays(a), bd = transitDays(b)
    if (ad !== bd) return ad - bd
    return centsValue(a) - centsValue(b)
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id
    const query = req.scope.resolve<Query>("query")

    const body = (req.body || {}) as {
      package_overrides?: PackageOverrides
      offset?: number
      limit?: number
      expected_ship_date_override?: { year: number; month: number; day: number }
    }

    const offset = Math.max(0, Number(body.offset ?? 0))
    const limit = Math.min(10, Math.max(1, Number(body.limit ?? 10)))

    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "email",
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
        phone_number:{
          number:"9023064110"
        }
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

    const expected_ship_date = body.expected_ship_date_override ?? getExpectedShipDate()
    const { packages, debug, defaults } = buildFreightcomPackages(order, body.package_overrides)

    const payload = {
      details: {
        origin,
        destination,
        expected_ship_date,
        packaging_type: "package",
        packaging_properties: { packages },
      },
    }

    const created = await freightcomRequest("/rate", { method: "POST", body: payload })
    const request_id = created?.request_id
    if (!request_id) {
      return res.status(502).json({ message: "Freightcom did not return request_id.", raw: created })
    }

    const MAX_WAIT_MS = Number(process.env.FREIGHTCOM_RATE_POLL_MAX_MS || 12000)
    const INTERVAL_MS = Number(process.env.FREIGHTCOM_RATE_POLL_INTERVAL_MS || 1000)

    const started = Date.now()
    let lastRaw: any = null

    while (Date.now() - started < MAX_WAIT_MS) {
      const raw = await freightcomRequest(`/rate/${request_id}`, { method: "GET" })
      lastRaw = raw
      if (raw?.status?.done && Array.isArray(raw?.rates)) break
      await sleep(INTERVAL_MS)
    }

    const preview = {
      origin,
      destination,
      expected_ship_date,
      package_defaults_used: defaults,
      package_debug: debug,
      packages_preview: packages.slice(0, 3),
    }

    if (!(lastRaw?.status?.done && Array.isArray(lastRaw?.rates))) {
      return res.status(202).json({
        request_id,
        status: "processing",
        status_meta: lastRaw?.status,
        preview,
      })
    }

    const allRates: FreightcomRate[] = lastRaw.rates
    const master = smartMasterSort(allRates)

    const pageSlice = master.slice(offset, offset + limit)
    const total = master.length
    const next_offset = offset + limit >= total ? 0 : offset + limit

    return res.status(200).json({
      request_id,
      status: "ready",
      status_meta: lastRaw.status,
      preview,
      rates: pageSlice,
      rates_total: total,
      offset,
      limit,
      next_offset,
    })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Unknown error" })
  }
}
