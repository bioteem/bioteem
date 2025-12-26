import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService, Query } from "@medusajs/framework/types"

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
  const body = opts?.body ? JSON.stringify(opts.body) : undefined

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

/** Remove any key that is freightcom_* OR your older nested objects */
function stripFreightcomMetadata(meta: Record<string, any>) {
  const next: Record<string, any> = {}

  for (const [k, v] of Object.entries(meta || {})) {
    // wipe flat keys
    if (k.startsWith("freightcom_")) continue

    // wipe older nested objects you mentioned
    if (k === "freightcom") continue

    // if you used metadata.freightcom = { ... } historically, remove it
    next[k] = v
  }

  return next
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id
    const shipmentId = req.params.shipment_id
    if (!orderId) return res.status(400).json({ message: "Missing order id" })
    if (!shipmentId) return res.status(400).json({ message: "Missing shipment_id" })

    // 1) cancel at freightcom
    const cancelled = await freightcomRequest(`/shipment/${shipmentId}`, { method: "DELETE" })

    // 2) read current order metadata
    const query = req.scope.resolve<Query>("query")
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })

    const order = data?.[0]
    if (!order) return res.status(404).json({ message: "Order not found" })

    // 3) wipe freightcom keys
    const prevMeta = (order.metadata || {}) as Record<string, any>
    const nextMeta = stripFreightcomMetadata(prevMeta)

    // optional: keep a tiny audit trail (NOT required)
    // nextMeta.freightcom_last_cancelled_at = new Date().toISOString()

    // 4) persist
    const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModule.updateOrders(orderId, { metadata: nextMeta })

    return res.status(200).json({
      cancelled,
      metadata_reset: true,
      order_id: orderId,
      shipment_id: shipmentId,
    })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Unknown error" })
  }
}