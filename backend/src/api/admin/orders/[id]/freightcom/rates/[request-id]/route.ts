import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const AUTHENTICATE = true

/* --------------------------------------------------
  Helpers
-------------------------------------------------- */

function getEnv(name: string) {
  const v = process.env[name]
  if (!v) {
    console.error(`❌ Missing env: ${name}`)
    throw new Error(`Missing env: ${name}`)
  }
  return v
}

async function freightcomGet(path: string) {
  const base = getEnv("FREIGHTCOM_API_BASE_URL")
  const key = getEnv("FREIGHTCOM_API_KEY")

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
    console.error("❌ Freightcom GET failed", {
      url,
      status: res.status,
      body: json ?? text,
    })
    throw new Error(`Freightcom ${res.status}`)
  }

  return json ?? {}
}

/* --------------------------------------------------
  Sorting / prioritization
-------------------------------------------------- */

const PRIORITY_CARRIERS = ["fedex", "ups", "purolator"]

function carrierPriority(name?: string) {
  if (!name) return 99
  const n = name.toLowerCase()
  const idx = PRIORITY_CARRIERS.findIndex((c) => n.includes(c))
  return idx === -1 ? 99 : idx
}

function sortRates(rates: any[], sort: string) {
  const list = [...rates]

  list.sort((a, b) => {
    // 1) Carrier priority first
    const pa = carrierPriority(a.carrier_name)
    const pb = carrierPriority(b.carrier_name)
    if (pa !== pb) return pa - pb

    // 2) Sort mode
    if (sort === "price") {
      return Number(a.total?.value || 0) - Number(b.total?.value || 0)
    }

    if (sort === "days") {
      return Number(a.transit_time_days ?? 999) - Number(b.transit_time_days ?? 999)
    }

    // 3) Default "best"
    const priceDiff =
      Number(a.total?.value || 0) - Number(b.total?.value || 0)
    if (priceDiff !== 0) return priceDiff

    return Number(a.transit_time_days ?? 999) - Number(b.transit_time_days ?? 999)
  })

  return list
}

/* --------------------------------------------------
  Route
-------------------------------------------------- */

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const rateId = req.params["rate-id"]

    const page = Math.max(1, Number(req.query.page || 1))
    const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size || 20)))
    const sort = String(req.query.sort || "best")

    // Fetch from Freightcom
    const result = await freightcomGet(`/rate/${rateId}`)

    const status = result.status ?? {}
    const allRates: any[] = Array.isArray(result.rates) ? result.rates : []

    // Sort + prioritize
    const sorted = sortRates(allRates, sort)

    // Pagination
    const totalRates = sorted.length
    const totalPages = Math.max(1, Math.ceil(totalRates / pageSize))
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const pagedRates = sorted.slice(start, end)

    return res.json({
      request_id: rateId,
      status,
      sort,
      pagination: {
        page,
        page_size: pageSize,
        total_rates: totalRates,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
      rates: pagedRates,
    })
  } catch (e: any) {
    return res.status(500).json({
      message: e?.message || "Failed to fetch Freightcom rates",
    })
  }
}
