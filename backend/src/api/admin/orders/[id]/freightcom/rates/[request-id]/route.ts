import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const AUTHENTICATE = true

/* ---------------------------------
  Safe helpers (NO throws at import)
---------------------------------- */

function safeEnv(name: string) {
  return process.env[name] || null
}

async function safeFreightcomGet(path: string) {
  const base = safeEnv("FREIGHTCOM_API_BASE_URL")
  const key = safeEnv("FREIGHTCOM_API_KEY")

  if (!base || !key) {
    throw new Error("Freightcom env vars missing")
  }

  if (typeof fetch !== "function") {
    throw new Error("fetch not available in runtime")
  }

  const res = await fetch(`${base}${path}`, {
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
    throw new Error(`Freightcom ${res.status}`)
  }

  return json ?? {}
}

/* ---------------------------------
  Sorting helpers
---------------------------------- */

const PRIORITY = ["fedex", "ups", "purolator"]

function carrierRank(name?: string) {
  if (!name) return 99
  const n = name.toLowerCase()
  const idx = PRIORITY.findIndex((p) => n.includes(p))
  return idx === -1 ? 99 : idx
}

function sortRates(rates: any[], sort: string) {
  return [...rates].sort((a, b) => {
    const pa = carrierRank(a.carrier_name)
    const pb = carrierRank(b.carrier_name)
    if (pa !== pb) return pa - pb

    if (sort === "price") {
      return Number(a.total?.value || 0) - Number(b.total?.value || 0)
    }

    if (sort === "days") {
      return Number(a.transit_time_days ?? 999) - Number(b.transit_time_days ?? 999)
    }

    const priceDiff =
      Number(a.total?.value || 0) - Number(b.total?.value || 0)
    if (priceDiff !== 0) return priceDiff

    return Number(a.transit_time_days ?? 999) - Number(b.transit_time_days ?? 999)
  })
}

/* ---------------------------------
  GET route (SAFE)
---------------------------------- */

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const rateId = req.params["rate-id"]

    const page = Math.max(1, Number(req.query.page || 1))
    const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size || 20)))
    const sort = String(req.query.sort || "best")

    const result = await safeFreightcomGet(`/rate/${rateId}`)

    const status = result.status ?? {}
    const allRates = Array.isArray(result.rates) ? result.rates : []

    const sorted = sortRates(allRates, sort)

    const total = sorted.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize
    const end = start + pageSize

    return res.json({
      request_id: rateId,
      status,
      sort,
      pagination: {
        page,
        page_size: pageSize,
        total_rates: total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
      rates: sorted.slice(start, end),
    })
  } catch (e: any) {
    return res.status(500).json({
      message: e?.message || "Failed to fetch Freightcom rates",
    })
  }
}
