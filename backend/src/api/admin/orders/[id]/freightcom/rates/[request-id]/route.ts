import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const AUTHENTICATE = true

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function freightcomGet(path: string) {
  const base = requireEnv("FREIGHTCOM_API_BASE_URL")
  const key = requireEnv("FREIGHTCOM_API_KEY")

  const url = `${base}${path}`

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: key,
    },
  })

  const text = await res.text().catch(() => "")

  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    throw new Error(`Freightcom ${res.status}: ${JSON.stringify(json ?? { raw: text })}`)
  }

  return json ?? {}
}

const PRIORITY = ["FEDEX", "UPS", "PUROLATOR"]

function carrierPriority(carrierName?: string) {
  const c = (carrierName || "").toUpperCase()
  const idx = PRIORITY.findIndex((p) => c.includes(p))
  return idx === -1 ? 999 : idx
}

// Freightcom totals are strings (likely cents). Convert safely for sorting.
function asNumber(x: any, fallback = Number.POSITIVE_INFINITY) {
  const n = typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN
  return Number.isFinite(n) ? n : fallback
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const requestId = req.params.request_id

    const page = Math.max(1, Number(req.query.page || 1))
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size || 20)))
    const sort = String(req.query.sort || "best") // best | price | days

    const result = await freightcomGet(`/rate/${requestId}`)

    const status = {
      done: Boolean(result?.status?.done),
      total: asNumber(result?.status?.total, 0),
      complete: asNumber(result?.status?.complete, 0),
    }

    const rates = Array.isArray(result?.rates) ? result.rates : []

    const normalized = rates.map((r: any) => {
      const totalCents = asNumber(r?.total?.value)
      const transitDays =
        r?.transit_time_not_available ? Number.POSITIVE_INFINITY : asNumber(r?.transit_time_days)

      return {
        ...r,
        _sort: {
          carrier: carrierPriority(r?.carrier_name),
          price: totalCents,
          days: transitDays,
        },
      }
    })

    normalized.sort((a: any, b: any) => {
      const ap = a._sort.carrier
      const bp = b._sort.carrier
      const aPrice = a._sort.price
      const bPrice = b._sort.price
      const aDays = a._sort.days
      const bDays = b._sort.days

      if (sort === "price") {
        if (aPrice !== bPrice) return aPrice - bPrice
        if (ap !== bp) return ap - bp
        return aDays - bDays
      }

      if (sort === "days") {
        if (aDays !== bDays) return aDays - bDays
        if (ap !== bp) return ap - bp
        return aPrice - bPrice
      }

      // "best": priority carriers first, then cheapest, then fastest
      if (ap !== bp) return ap - bp
      if (aPrice !== bPrice) return aPrice - bPrice
      return aDays - bDays
    })

    const sortedRates = normalized.map(({ _sort, ...r }: any) => r)

    const start = (page - 1) * pageSize
    const end = start + pageSize
    const pageRates = sortedRates.slice(start, end)

    return res.json({
      request_id: requestId,
      status,
      sort,
      pagination: {
        page,
        page_size: pageSize,
        total_rates: sortedRates.length,
        total_pages: Math.max(1, Math.ceil(sortedRates.length / pageSize)),
        has_next: end < sortedRates.length,
        has_prev: page > 1,
      },
      rates: pageRates,
    })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to fetch rates" })
  }
}
