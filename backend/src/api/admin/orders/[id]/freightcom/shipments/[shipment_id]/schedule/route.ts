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

async function freightcomRequestSafe(
  path: string,
  opts?: { method?: string; body?: any }
): Promise<{ ok: boolean; status: number; data: any; raw?: string }> {
  const base = requireEnv("FREIGHTCOM_API_BASE_URL")
  const key = requireEnv("FREIGHTCOM_API_KEY")
  const url = `${base}${path}`

  const res = await fetch(url, {
    method: opts?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: key,
    },
    body: opts?.body ? JSON.stringify(opts.body, null, 2) : undefined,
  })

  const text = await res.text().catch(() => "")
  let json: any = null

  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  return {
    ok: res.ok,
    status: res.status,
    data: json ?? (text ? { raw: text } : null),
    raw: text,
  }
}

function stripPickupMeta(prev: Record<string, any> = {}) {
  const next = { ...prev }
  delete next.freightcom_pickup_status
  delete next.freightcom_pickup_error
  delete next.freightcom_pickup_confirmation_number
  delete next.freightcom_pickup_last_sync_at
  delete next.freightcom_pickup_request
  return next
}

async function getOrderAndAssertShipment(
  req: MedusaRequest,
  orderId: string,
  shipmentId: string
) {
  const query = req.scope.resolve<Query>("query")

  const result = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id: orderId },
  })

  const order = (result as any)?.data?.[0]
  if (!order) {
    const e: any = new Error("Order not found")
    e.status = 404
    throw e
  }

  const meta = (order.metadata || {}) as Record<string, any>
  const storedShipmentId = meta.freightcom_shipment_id as string | undefined

  if (storedShipmentId && storedShipmentId !== shipmentId) {
    const e: any = new Error("Shipment id does not match order metadata")
    e.status = 409
    e.code = "SHIPMENT_ID_MISMATCH"
    throw e
  }

  return { order, meta }
}

/* =========================
   GET – fetch pickup status
   ========================= */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id: orderId, shipment_id: shipmentId } = req.params

    if (!orderId || !shipmentId) {
      return res.status(400).json({ message: "Missing order id or shipment_id" })
    }

    const { meta } = await getOrderAndAssertShipment(req, orderId, shipmentId)

    const r = await freightcomRequestSafe(`/shipment/${shipmentId}/schedule`)

    const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)

    if (!r.ok && r.status === 404) {
      await orderModule.updateOrders(orderId, {
        metadata: {
          ...stripPickupMeta(meta),
          freightcom_pickup_last_sync_at: new Date().toISOString(),
        },
      })
      return res.status(200).json({ exists: false })
    }

    if (!r.ok) {
      throw new Error(`Freightcom ${r.status}: ${JSON.stringify(r.data)}`)
    }

    await orderModule.updateOrders(orderId, {
      metadata: {
        ...meta,
        freightcom_pickup_status: r.data?.status ?? null,
        freightcom_pickup_error: r.data?.error ?? null,
        freightcom_pickup_confirmation_number:
          r.data?.pickup_confirmation_number ?? null,
        freightcom_pickup_last_sync_at: new Date().toISOString(),
      },
    })

    return res.status(200).json({ exists: true, ...r.data })
  } catch (e: any) {
    return res
      .status(e?.status || 500)
      .json({ message: e?.message || "Unknown error", code: e?.code })
  }
}

/* =========================
   POST – schedule pickup
   ========================= */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id: orderId, shipment_id: shipmentId } = req.params
    if (!orderId || !shipmentId) {
      return res.status(400).json({ message: "Missing order id or shipment_id" })
    }

    const payload = req.body || {}
    const { meta } = await getOrderAndAssertShipment(req, orderId, shipmentId)

    const r = await freightcomRequestSafe(`/shipment/${shipmentId}/schedule`, {
      method: "POST",
      body: payload,
    })

    if (!r.ok) {
      throw new Error(`Freightcom ${r.status}: ${JSON.stringify(r.data)}`)
    }

    const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)

    await orderModule.updateOrders(orderId, {
      metadata: {
        ...meta,
        freightcom_pickup_request: payload,
        freightcom_pickup_status: r.data?.status ?? "pending",
        freightcom_pickup_error: r.data?.error ?? null,
        freightcom_pickup_confirmation_number:
          r.data?.pickup_confirmation_number ?? null,
        freightcom_pickup_last_sync_at: new Date().toISOString(),
      },
    })

    return res.status(200).json(r.data)
  } catch (e: any) {
    return res
      .status(e?.status || 500)
      .json({ message: e?.message || "Unknown error", code: e?.code })
  }
}

/* =========================
   DELETE – cancel pickup
   ========================= */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id: orderId, shipment_id: shipmentId } = req.params
    if (!orderId || !shipmentId) {
      return res.status(400).json({ message: "Missing order id or shipment_id" })
    }

    const { meta } = await getOrderAndAssertShipment(req, orderId, shipmentId)

    // Try cancelling on Freightcom, but DO NOT trust their status
    const r = await freightcomRequestSafe(`/shipment/${shipmentId}/schedule`, {
      method: "DELETE",
    })

    const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)

    // ALWAYS clear pickup metadata — even if Freightcom errors
    await orderModule.updateOrders(orderId, {
      metadata: {
        ...stripPickupMeta(meta),
        freightcom_pickup_last_sync_at: new Date().toISOString(),
      },
    })

    // Treat 200, 404, 500 as SUCCESS
    return res.status(200).json({
      cleared: true,
      freightcom_status: r.status,
    })
  } catch (e: any) {
    return res.status(500).json({
      message: e?.message || "Unknown error",
    })
  }
}