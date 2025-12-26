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

  if (!res.ok) throw new Error(`Freightcom ${res.status}: ${JSON.stringify(json ?? { raw: text })}`)
  return json ?? { raw: text }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id
    const shipmentId = req.params.shipment_id

    if (!orderId) return res.status(400).json({ message: "Missing order id" })
    if (!shipmentId) return res.status(400).json({ message: "Missing shipment_id" })

    // 1) Cancel at Freightcom
    const cancelled = await freightcomRequest(`/shipment/${shipmentId}`, { method: "DELETE" })

    // 2) Clear metadata on the order (and delete any legacy freightcom_* keys)
    const query = req.scope.resolve<Query>("query")
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })

    const order = data?.[0]
    if (!order) return res.status(404).json({ message: "Order not found" })

    const prevMeta = (order.metadata || {}) as Record<string, any>
    const cleanedMeta: Record<string, any> = { ...prevMeta }

    // remove flat legacy keys
    for (const k of Object.keys(cleanedMeta)) {
      if (k.startsWith("freightcom_")) delete cleanedMeta[k]
    }

    // remove the object too (since shipment is cancelled)
    delete cleanedMeta.freightcom

    const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModule.updateOrders(orderId, { metadata: cleanedMeta })

    return res.status(200).json({ cancelled, cleared: true })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Unknown error" })
  }
}