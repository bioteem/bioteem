// src/api/admin/subscriptions/route.ts
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import SubscriptionModuleService from "../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../modules/subscription"

/**
 * GET /admin/subscriptions
 * Returns all subscriptions (you can add pagination/filters later).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  const subscriptions = await subscriptionModuleService.listSubscriptions({})

  res.json({ subscriptions })
}