// src/modules/subscription/models/subscription-plan.ts
import { model } from "@medusajs/framework/utils"

const SubscriptionPlan = model.define("subscription_plan", {
  id: model.id().primaryKey(),

  // which Medusa product this plan is for
  product_id: model.text(),

  // e.g. "Monthly subscription", "Every 2 months"
  name: model.text(),

  // Optional display info (not critical to logic)
  interval: model.enum(["day", "week", "month", "year"]).nullable(),
  interval_count: model.number().nullable(),

  // Stripe linkage
  stripe_price_id: model.text(),    // recurring Price ID (price_xxx)
  payment_link_url: model.text(),   // Stripe Payment Link URL

  active: model.boolean().default(true),
  unit_amount: model.number().nullable(),
currency: model.text().nullable(),
})

export default SubscriptionPlan