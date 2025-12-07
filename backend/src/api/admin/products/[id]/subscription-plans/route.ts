// src/api/admin/products/[id]/subscription-plans/route.ts
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import SubscriptionModuleService from "../../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../../modules/subscription"

type CreatePlanBody = {
  name: string
  interval?: "day" | "week" | "month" | "year"
  interval_count?: number
  stripe_price_id: string
  payment_link_url: string
  active?: boolean
}

/**
 * GET /admin/products/:id/subscription-plans
 * Return all subscription plans for a given product.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id: product_id } = req.params

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  const plans = await subscriptionModuleService.listSubscriptionPlans({
    product_id,
  })

  res.json({ subscription_plans: plans })
}

/**
 * POST /admin/products/:id/subscription-plans
 * Create a new subscription plan (option) for a product.
 */
export const POST = async (
  req: MedusaRequest<CreatePlanBody>,
  res: MedusaResponse
) => {
  const { id: product_id } = req.params
  const {
    name,
    interval,
    interval_count,
    stripe_price_id,
    payment_link_url,
    active,
  } = req.body

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  const plan = await subscriptionModuleService.createSubscriptionPlans({
    product_id,
    name,
    interval: interval ?? null,
    interval_count: interval_count ?? null,
    stripe_price_id,
    payment_link_url,
    active: active ?? true,
  })

  res.status(201).json({ subscription_plan: plan })
}