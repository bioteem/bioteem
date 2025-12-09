// src/api/store/products/[id]/subscription-plans/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import SubscriptionModuleService from "../../../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../../../modules/subscription"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id: productId } = req.params

  console.log(
    "[store.subscription-plans] GET subscription plans for product",
    productId
  )

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  try {
    const plans = await subscriptionModuleService.listSubscriptionPlans({
      product_id: productId,
      // comment out active filter while debugging if you want
      // active: true,
    })

    console.log(
      "[store.subscription-plans] Found plans",
      plans.map((p) => ({ id: p.id, name: p.name }))
    )

    return res.json({ subscription_plans: plans })
  } catch (e) {
    console.error(
      "[store.subscription-plans] Failed to list plans for product",
      productId,
      e
    )

    // still return a 200 with empty list so the frontend never blows up
    return res.json({ subscription_plans: [] })
  }
}