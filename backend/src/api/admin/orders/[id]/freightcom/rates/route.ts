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

  // After 4pm → start from next day
  if (d.getHours() >= 16) d.setDate(d.getDate() + 1)

  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)

  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
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

  // Outgoing debug
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

    const weightG = Number.isFinite(Number(v.weight))
      ? Number(v.weight)
      : DEFAULT_WEIGHT_G
    const Lcm = Number.isFinite(Number(v.length)) ? Number(v.length) : DEFAULT_L_CM
    const Wcm = Number.isFinite(Number(v.width)) ? Number(v.width) : DEFAULT_W_CM
    const Hcm = Number.isFinite(Number(v.height))
      ? Number(v.height)
      : DEFAULT_H_CM

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

/**
 * Freightcom response:
 * {
 *   status: { done: true, total: 127, complete: 127 },
 *   rates: [...]
 * }
 */
type FreightcomStatus = { done?: boolean; total?: number; complete?: number }
type FreightcomRate = {
  service_id: string
  valid_until?: { year: number; month: number; day: number }
  total?: { value: string; currency: string }
  base?: { value: string; currency: string }
  surcharges?: Array<{ type: string; amount?: { value: string; currency: string } }>
  taxes?: Array<{ type: string; amount?: { value: string; currency: string } }>
  transit_time_days?: number
  transit_time_not_available?: boolean
  carrier_name?: string
  service_name?: string
  paperless?: boolean
}

type FreightcomRateResponse = {
  status?: FreightcomStatus
  rates?: FreightcomRate[]
  request_id?: string
}

type NormalizedRate = {
  id: string
  carrier: string
  service: string
  service_id: string
  total_cents: number | null
  total: number | null
  currency: string | null
  base_cents: number | null
  base: number | null
  transit_days: number | null
  transit_not_available: boolean
  valid_until?: { year: number; month: number; day: number }
  paperless?: boolean
  surcharges: Array<{
    type: string
    amount_cents: number | null
    amount: number | null
    currency: string | null
  }>
  taxes: Array<{
    type: string
    amount_cents: number | null
    amount: number | null
    currency: string | null
  }>
  raw: FreightcomRate
}

function isRatesReadyFreightcom(raw: any): boolean {
  const r = raw as FreightcomRateResponse
  return Boolean(r?.status?.done) && Array.isArray(r?.rates)
}

function parseCents(v: any): number | null {
  // Freightcom values look like "2116" => $21.16
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}
function centsToDollars(c: number | null): number | null {
  return c === null ? null : Math.round(c) / 100
}

function normalizeFreightcomRate(rate: FreightcomRate): NormalizedRate {
  const total_cents = parseCents(rate?.total?.value)
  const base_cents = parseCents(rate?.base?.value)

  const currency = rate?.total?.currency ?? rate?.base?.currency ?? null

  const surcharges = (rate?.surcharges || []).map((s) => {
    const cents = parseCents(s?.amount?.value)
    return {
      type: s?.type || "unknown",
      amount_cents: cents,
      amount: centsToDollars(cents),
      currency: s?.amount?.currency ?? currency ?? null,
    }
  })

  const taxes = (rate?.taxes || []).map((t) => {
    const cents = parseCents(t?.amount?.value)
    return {
      type: t?.type || "unknown",
      amount_cents: cents,
      amount: centsToDollars(cents),
      currency: t?.amount?.currency ?? currency ?? null,
    }
  })

  return {
    id: rate.service_id,
    carrier: rate.carrier_name || "Unknown",
    service: rate.service_name || rate.service_id,
    service_id: rate.service_id,
    total_cents,
    total: centsToDollars(total_cents),
    currency,
    base_cents,
    base: centsToDollars(base_cents),
    transit_days: Number.isFinite(Number(rate.transit_time_days))
      ? Number(rate.transit_time_days)
      : null,
    transit_not_available: Boolean(rate.transit_time_not_available),
    valid_until: rate.valid_until,
    paperless: rate.paperless,
    surcharges,
    taxes,
    raw: rate,
  }
}

function carrierPriorityScore(carrierName: string): number {
  const s = (carrierName || "").toLowerCase()

  // Lower = higher priority
  if (s.includes("purolator")) return 0
  if (s.includes("fedex") || s.includes("fed ex")) return 1
  if (s.includes("ups")) return 2
  if (s.includes("dhl")) return 3
  if (s.includes("canada post") || s.includes("canadapost")) return 4

  // Regional/others
  if (s.includes("canpar")) return 10

  return 50
}

function sortRatesMajorFirst(rates: NormalizedRate[]): NormalizedRate[] {
  return [...rates].sort((a, b) => {
    const ap = carrierPriorityScore(a.carrier)
    const bp = carrierPriorityScore(b.carrier)
    if (ap !== bp) return ap - bp

    // Cheapest first (nulls last)
    const at = a.total_cents ?? Number.POSITIVE_INFINITY
    const bt = b.total_cents ?? Number.POSITIVE_INFINITY
    if (at !== bt) return at - bt

    // Prefer known transit times
    const aPenalty = a.transit_not_available ? 1 : 0
    const bPenalty = b.transit_not_available ? 1 : 0
    if (aPenalty !== bPenalty) return aPenalty - bPenalty

    // Faster first
    const ad = a.transit_days ?? Number.POSITIVE_INFINITY
    const bd = b.transit_days ?? Number.POSITIVE_INFINITY
    return ad - bd
  })
}

function parsePagination(q: any) {
  const page = Math.max(1, Number(q?.page || 1))
  const page_size = Math.min(100, Math.max(1, Number(q?.page_size || 20)))
  const offset = (page - 1) * page_size
  return { page, page_size, offset }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id

    // Medusa v2: use fields (explicit), NOT select/relations
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
      filters: { id: orderId },
    })

    const order = data?.[0]
    if (!order) return res.status(404).json({ message: "Order not found" })

    const ship = order.shipping_address
    if (!ship?.postal_code || !ship?.country_code) {
      return res.status(400).json({
        message: "Order shipping address missing postal code / country.",
      })
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
      residential: true,
      email_addresses: [process.env.WAREHOUSE_EMAIL || "sales@bioteem40.ca"],
      receives_email_updates: false,
    }

    const destination = {
      name:
        `${ship.first_name || ""} ${ship.last_name || ""}`.trim() || "Customer",
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
        expected_ship_date: getExpectedShipDate(),
        packaging_type: "package",
        packaging_properties: { packages: buildFreightcomPackages(order) },
      },
    }

    // 1) Create rate request
    const created = await freightcomRequest("/rate", { method: "POST", body: payload })
    const request_id = created?.request_id

    if (!request_id) {
      return res.status(502).json({
        message: "Freightcom did not return request_id.",
        raw: created,
      })
    }

    // 2) Poll results briefly; if not ready, return 202 with request_id
    const MAX_WAIT_MS = Number(process.env.FREIGHTCOM_RATE_POLL_MAX_MS || 12000)
    const INTERVAL_MS = Number(process.env.FREIGHTCOM_RATE_POLL_INTERVAL_MS || 1000)

    const started = Date.now()
    let lastRaw: any = null

    while (Date.now() - started < MAX_WAIT_MS) {
      const raw = await freightcomRequest(`/rate/${request_id}`, { method: "GET" })
      lastRaw = raw

      if (isRatesReadyFreightcom(raw)) break
      await sleep(INTERVAL_MS)
    }

    if (!isRatesReadyFreightcom(lastRaw)) {
      return res.status(202).json({
        request_id,
        status: "processing",
      })
    }

    // 3) Normalize, sort, paginate
    const rawRates = (lastRaw?.rates || []) as FreightcomRate[]
    const normalized = rawRates.map(normalizeFreightcomRate)
    const sorted = sortRatesMajorFirst(normalized)

    const { page, page_size, offset } = parsePagination(req.query)
    const paged = sorted.slice(offset, offset + page_size)

    return res.status(200).json({
      request_id,
      status: "ready",
      status_meta: lastRaw?.status,
      pagination: {
        page,
        page_size,
        total: sorted.length,
        total_pages: Math.max(1, Math.ceil(sorted.length / page_size)),
      },
      rates: paged,
      raw: process.env.RETURN_FREIGHTCOM_RAW === "true" ? lastRaw : undefined,
    })
  } catch (e: any) {
    return res.status(500).json({
      message: e?.message || "Unknown error",
    })
  }
}

