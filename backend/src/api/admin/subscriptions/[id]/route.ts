// src/api/admin/subscriptions/[id]/route.ts
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import SubscriptionModuleService from "../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../modules/subscription"

/**
 * GET /admin/subscriptions/:id
 * Returns a single subscription (for a detailed view).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  const subscription = await subscriptionModuleService.retrieveSubscription(id)

  res.json({ subscription })
}