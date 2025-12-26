import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const AUTHENTICATE = true

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function freightcomRequest(path: string, opts?: { method?: string; body?: any }) {
  const base = requireEnv("FREIGHTCOM_API_BASE_URL")
  const key = requireEnv("FREIGHTCOM_API_KEY")
  const url = `${base}${path}`

  const method = opts?.method || "GET"
  const body = opts?.body ? JSON.stringify(opts.body, null, 2) : undefined

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
    throw new Error(`Freightcom ${res.status}: ${JSON.stringify(json ?? { raw: text })}`)
  }

  return json ?? { raw: text }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const shipmentId = req.params.shipment_id
    if (!shipmentId) return res.status(400).json({ message: "Missing shipment_id" })

    const data = await freightcomRequest(`/shipment/${shipmentId}`, { method: "GET" })
    return res.status(200).json(data)
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Unknown error" })
  }
}