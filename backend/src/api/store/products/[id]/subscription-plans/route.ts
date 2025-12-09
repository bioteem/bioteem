// src/api/store/products/[id]/subscription-plans/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import SubscriptionModuleService from "../../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../../modules/subscription"

type PlansResponse = {
  subscription_plans: any[]
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id: productId } = req.params

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  const plans = await subscriptionModuleService.listSubscriptionPlans({
    product_id: productId,
    active: true,
  })

  const response: PlansResponse = { subscription_plans: plans }

  return res.json(response)
}