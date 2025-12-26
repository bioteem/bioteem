import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Query } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService } from "@medusajs/framework/types"

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

// remove everything freightcom-related so UI fully resets
function stripAllFreightcomMeta(prev: Record<string, any>) {
  const next: Record<string, any> = {}
  for (const [k, v] of Object.entries(prev)) {
    if (!k.startsWith("freightcom_") && k !== "freightcom") next[k] = v
  }
  // also delete object key if you used it before
  // (kept out by filter above, but included for clarity)
  delete (next as any).freightcom
  return next
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id
    const shipmentId = req.params.shipment_id

    if (!orderId) return res.status(400).json({ message: "Missing order id" })
    if (!shipmentId) return res.status(400).json({ message: "Missing shipment_id" })

    // cancel in Freightcom
    const cancelled = await freightcomRequest(`/shipment/${shipmentId}`, { method: "DELETE" })

    // load order + clear metadata
    const query = req.scope.resolve<Query>("query")
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })
    const order = data?.[0]
    if (!order) return res.status(404).json({ message: "Order not found" })

    const prevMeta = (order.metadata || {}) as Record<string, any>
    const nextMeta = stripAllFreightcomMeta(prevMeta)

    const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModule.updateOrders(orderId, { metadata: nextMeta })

    return res.status(200).json({ cancelled, metadata_reset: true })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Unknown error" })
  }
}