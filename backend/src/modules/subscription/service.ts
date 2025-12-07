// src/modules/subscription/service.ts
import { MedusaService } from "@medusajs/framework/utils"
import SubscriptionPlan from "./models/subscription-plan"
import Subscription from "./models/subscription"

class SubscriptionModuleService extends MedusaService({
  SubscriptionPlan,
  Subscription,
}) {
  // generated methods:
  // - listSubscriptionPlans, createSubscriptionPlans, updateSubscriptionPlans, ...
  // - listSubscriptions, createSubscriptions, updateSubscriptions, ...
}

export default SubscriptionModuleService