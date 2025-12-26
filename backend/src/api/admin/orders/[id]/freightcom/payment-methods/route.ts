import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const AUTHENTICATE = true

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function freightcomRequest(path: string) {
  const base = requireEnv("FREIGHTCOM_API_BASE_URL")
  const key = requireEnv("FREIGHTCOM_API_KEY")
  const url = `${base}${path}`

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: key },
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

function normalizePaymentMethods(raw: any) {
  const items =
    raw?.payment_methods ??
    raw?.methods ??
    raw?.data ??
    (Array.isArray(raw) ? raw : [])

  if (!Array.isArray(items)) return []

  return items.map((m: any) => {
    const id = m?.id ?? m?.payment_method_id ?? m?.uuid ?? m?.code ?? String(m)
    const label =
      m?.name ??
      m?.label ??
      m?.display_name ??
      m?.type ??
      m?.method_name ??
      String(id)

    return { id: String(id), label: String(label), raw: m }
  })
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const path = "/finance/payment-methods"
    const raw = await freightcomRequest(path)

    return res.status(200).json({
      methods: normalizePaymentMethods(raw),
      raw: process.env.RETURN_FREIGHTCOM_RAW === "true" ? raw : undefined,
    })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Unknown error" })
  }
}
