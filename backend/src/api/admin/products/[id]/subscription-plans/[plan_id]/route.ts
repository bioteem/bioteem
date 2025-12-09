// src/api/admin/products/[id]/subscription-plans/[plan_id]/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import SubscriptionModuleService from "../../../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../../../modules/subscription"

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { plan_id } = req.params

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  // Hard-delete the plan (no soft delete for now)
  await subscriptionModuleService.deleteSubscriptionPlans(plan_id)

  return res.status(204).send()
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id: productId } = req.params

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  const plans = await subscriptionModuleService.listSubscriptionPlans({
    product_id: productId,
    active: true,
  })

  res.json({ subscription_plans: plans })
}