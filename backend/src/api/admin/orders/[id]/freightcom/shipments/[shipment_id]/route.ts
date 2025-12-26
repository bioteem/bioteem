import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const AUTHENTICATE = true

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function freightcomRequest(path: string, opts?: { method?: string; body?: any; timeoutMs?: number }) {
  const base = requireEnv("FREIGHTCOM_API_BASE_URL")
  const key = requireEnv("FREIGHTCOM_API_KEY")
  const url = `${base}${path}`

  const method = opts?.method || "GET"
  const body = opts?.body ? JSON.stringify(opts.body, null, 2) : undefined

  const controller = new AbortController()
  const timeoutMs = opts?.timeoutMs ?? 20000 // 20s
  const t = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: key },
      body,
      signal: controller.signal,
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

    return json ?? { raw: text }
  } finally {
    clearTimeout(t)
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const shipmentId = req.params.shipment_id
    if (!shipmentId) return res.status(400).json({ message: "Missing shipment_id" })

    const data = await freightcomRequest(`/shipment/${shipmentId}`, { method: "GET", timeoutMs: 20000 })

    // ✅ Always normalize for the widget
    const shipment = data?.shipment ?? data

    return res.status(200).json({ shipment })
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "Freightcom request timed out while loading shipment."
        : e?.message || "Unknown error"

    return res.status(500).json({ message: msg })
  }
}