import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import SubscriptionModuleService from "../../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../../modules/subscription"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // Log params so we know what Medusa thinks the productId is
  console.log(
    "[store.subscription-plans] Incoming request params:",
    req.params
  )

  const productId = req.params.id

  if (!productId) {
    console.warn(
      "[store.subscription-plans] Missing productId in params",
      req.params
    )
    // Still return 200 with empty list so storefront never gets 400
    return res.json({ subscription_plans: [] })
  }

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  try {
    const plans = await subscriptionModuleService.listSubscriptionPlans({
      product_id: productId,
      // comment out while debugging if you want:
      // active: true,
    })

    console.log(
      "[store.subscription-plans] Found plans for product",
      productId,
      plans.map((p) => ({
        id: p.id,
        name: p.name,
        active: p.active,
      }))
    )

    return res.json({ subscription_plans: plans })
  } catch (e: any) {
    console.error(
      "[store.subscription-plans] ERROR listing plans for product",
      productId,
      e?.message ?? e
    )

    // IMPORTANT: do NOT send 400 here; send 200 with error info
    return res.json({
      subscription_plans: [],
      error: e?.message ?? String(e),
    })
  }
}