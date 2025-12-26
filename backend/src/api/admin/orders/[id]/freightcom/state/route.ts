import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Query } from "@medusajs/framework/types"

export const AUTHENTICATE = true

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id
    const query = req.scope.resolve<Query>("query")

    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })

    const order = data?.[0]
    if (!order) return res.status(404).json({ message: "Order not found" })

    return res.status(200).json({
      freightcom: (order.metadata || {}).freightcom ?? null,
    })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Unknown error" })
  }
}