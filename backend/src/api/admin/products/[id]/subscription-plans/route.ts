// src/api/admin/products/[id]/subscription-plans/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import SubscriptionModuleService from "../../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../../modules/subscription"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id: productId } = req.params

  const {
    name,
    interval,
    interval_count,
    stripe_price_id,
    payment_link_url,
    active,
    unit_amount,
    currency,
  } = req.body as {
    name: string
    interval?: "day" | "week" | "month" | "year"
    interval_count?: number
    stripe_price_id: string
    payment_link_url?: string
    active?: boolean
    unit_amount?: number  // 💰 cents
    currency?: string     // "usd", "cad", ...
  }

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  const plan = await subscriptionModuleService.createSubscriptionPlans({
    product_id: productId,
    name,
    interval: interval ?? null,
    interval_count: interval_count ?? null,
    stripe_price_id,
    payment_link_url: payment_link_url ?? null,
    active: active ?? true,
    unit_amount: unit_amount ?? null,
    currency: currency ? currency.toLowerCase() : null,
  })

  return res.json({ subscription_plan: plan })
}