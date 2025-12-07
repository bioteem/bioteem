// src/modules/subscription/models/subscription.ts
import { model } from "@medusajs/framework/utils"

const Subscription = model.define("subscription", {
  id: model.id().primaryKey(),

  // Medusa customer & plan
  customer_id: model.text(),
  plan_id: model.text(),

  // Stripe references
  stripe_customer_id: model.text(),
  stripe_subscription_id: model.text(),
  stripe_latest_invoice_id: model.text().nullable(),

  status: model.enum([
    "incomplete",
    "active",
    "past_due",
    "canceled",
    "incomplete_expired",
    "trialing",
    "unpaid",
  ]),

  current_period_start: model.dateTime().nullable(),
  current_period_end: model.dateTime().nullable(),

  // Snapshot of contact + shipping info at subscription time
  billing_email: model.text().nullable(),

  shipping_name: model.text().nullable(),
  shipping_phone: model.text().nullable(),

  shipping_address_line1: model.text().nullable(),
  shipping_address_line2: model.text().nullable(),
  shipping_city: model.text().nullable(),
  shipping_province: model.text().nullable(),
  shipping_postal_code: model.text().nullable(),
  shipping_country: model.text().nullable(),

  // Last generated Medusa order from this subscription
  last_order_id: model.text().nullable(),
  last_order_created_at: model.dateTime().nullable(),
})

export default Subscription