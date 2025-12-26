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

function stripPickupMeta(prev: Record<string, any>) {
  const next = { ...prev }
  // wipe pickup-only keys (don’t touch shipment keys)
  delete next.freightcom_pickup_status
  delete next.freightcom_pickup_error
  delete next.freightcom_pickup_confirmation_number
  delete next.freightcom_pickup_last_sync_at
  delete next.freightcom_pickup_request
  return next
}

async function getOrderAndAssertShipment(req: MedusaRequest, orderId: string, shipmentId: string) {
  const query = req.scope.resolve<Query>("query")
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id: orderId },
  })

  const order = data?.[0]
  if (!order) throw new Error("Order not found")

  const meta = (order.metadata || {}) as Record<string, any>
  const stored = meta.freightcom_shipment_id as string | undefined

  // IMPORTANT: enforce shipment_id matches what’s on the order
  if (stored && stored !== shipmentId) {
    const e: any = new Error("Shipment id does not match order metadata")
    e.status = 409
    e.code = "SHIPMENT_ID_MISMATCH"
    throw e
  }

  return { order, meta }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id
    const shipmentId = req.params.shipment_id
    if (!orderId) return res.status(400).json({ message: "Missing order id" })
    if (!shipmentId) return res.status(400).json({ message: "Missing shipment_id" })

    const { meta } = await getOrderAndAssertShipment(req, orderId, shipmentId)

    const data = await freightcomRequest(`/shipment/${shipmentId}/schedule`, { method: "GET" })

    // Persist a simple snapshot so you can inspect in Admin UI
    const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModule.updateOrders(orderId, {
      metadata: {
        ...meta,
        freightcom_pickup_status: data?.status ?? null,
        freightcom_pickup_error: data?.error ?? null,
        freightcom_pickup_confirmation_number: data?.pickup_confirmation_number ?? null,
        freightcom_pickup_last_sync_at: new Date().toISOString(),
      },
    })

    return res.status(200).json(data)
  } catch (e: any) {
    const status = e?.status || 500
    return res.status(status).json({ message: e?.message || "Unknown error", code: e?.code })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id
    const shipmentId = req.params.shipment_id
    if (!orderId) return res.status(400).json({ message: "Missing order id" })
    if (!shipmentId) return res.status(400).json({ message: "Missing shipment_id" })

    const payload = req.body || {}
    const { meta } = await getOrderAndAssertShipment(req, orderId, shipmentId)

    const data = await freightcomRequest(`/shipment/${shipmentId}/schedule`, {
      method: "POST",
      body: payload,
    })

    // Save minimal inspectable keys + the request body used
    const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModule.updateOrders(orderId, {
      metadata: {
        ...meta,
        freightcom_pickup_request: payload, // yes it’s an object; useful for debugging
        freightcom_pickup_status: data?.status ?? "pending",
        freightcom_pickup_error: data?.error ?? null,
        freightcom_pickup_confirmation_number: data?.pickup_confirmation_number ?? null,
        freightcom_pickup_last_sync_at: new Date().toISOString(),
      },
    })

    return res.status(200).json(data)
  } catch (e: any) {
    const status = e?.status || 500
    return res.status(status).json({ message: e?.message || "Unknown error", code: e?.code })
  }
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id
    const shipmentId = req.params.shipment_id
    if (!orderId) return res.status(400).json({ message: "Missing order id" })
    if (!shipmentId) return res.status(400).json({ message: "Missing shipment_id" })

    const { meta } = await getOrderAndAssertShipment(req, orderId, shipmentId)

    const data = await freightcomRequest(`/shipment/${shipmentId}/schedule`, { method: "DELETE" })

    // Clear pickup metadata (shipment remains)
    const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModule.updateOrders(orderId, { metadata: stripPickupMeta(meta) })

    return res.status(200).json(data)
  } catch (e: any) {
    const status = e?.status || 500
    return res.status(status).json({ message: e?.message || "Unknown error", code: e?.code })
  }
}