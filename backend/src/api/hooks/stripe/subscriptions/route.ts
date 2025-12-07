// src/api/hooks/stripe/subscriptions/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Stripe from "stripe"
import SubscriptionModuleService from "../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../modules/subscription"
import { Modules } from "@medusajs/framework/utils"
import type { ICustomerModuleService } from "@medusajs/framework/types"

const stripe = new Stripe(process.env.STRIPE_API_KEY!)

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const sig = req.headers["stripe-signature"] as string | undefined
  const webhookSecret = process.env.STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    console.error(
      "[subscriptions] Missing Stripe signature or STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET"
    )
    return res.status(400).send("Missing Stripe signature or webhook secret")
  }

if (!req.rawBody) {
  console.error("[subscriptions] Missing rawBody on request", {
    hasBody: !!req.body,
    rawType: typeof req.rawBody,
  })
  return res.status(400).send("Missing raw body for Stripe webhook")
}

console.log(
  "[subscriptions] Got rawBody of length",
  (req.rawBody as Buffer).length
)

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret)
  } catch (err: any) {
    console.error(
      "[subscriptions] Stripe webhook signature verification failed:",
      err.message
    )
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  const customerModuleService = req.scope.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  )

  switch (event.type) {
    /**
     * Customer completed a Payment Link checkout for a subscription
     */
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.mode !== "subscription") {
        break
      }

      const stripeSubId = session.subscription as string | null
      const stripeCustomerId = session.customer as string | null

      if (!stripeSubId || !stripeCustomerId) {
        console.warn(
          "[subscriptions] checkout.session.completed missing subscription or customer"
        )
        break
      }

      const customerDetails = session.customer_details
      const shippingDetails = (session as any).shipping_details

      const email = customerDetails?.email
      const name = customerDetails?.name || ""

      if (!email) {
        console.warn(
          "[subscriptions] checkout.session.completed has no email, cannot create Medusa customer"
        )
        break
      }

      // 1️⃣ Find or create Medusa customer by email
      const [existingCustomer] = await customerModuleService.listCustomers({
        email,
      })

      let medusaCustomer = existingCustomer

      if (!medusaCustomer) {
        const [first_name, ...rest] = name.split(" ")
        const last_name = rest.join(" ") || null

        medusaCustomer = await customerModuleService.createCustomers({
          email,
          first_name: first_name || null,
          last_name,
          metadata: {
            stripe_customer_id: stripeCustomerId,
          },
        })
      } else {
        // ensure stripe_customer_id is stored
        const metadata = (medusaCustomer.metadata || {}) as Record<
          string,
          unknown
        >
        if (!metadata.stripe_customer_id) {
          await customerModuleService.updateCustomers(
            { id: medusaCustomer.id },
            {
              metadata: {
                ...metadata,
                stripe_customer_id: stripeCustomerId,
              },
            }
          )
        }
      }

      // 2️⃣ Load the Stripe Subscription to get the price (maps to our plan)
      const stripeSubResp = await stripe.subscriptions.retrieve(stripeSubId)
      const stripeSub = stripeSubResp as any

      const firstItem = stripeSub.items.data[0]
      const priceId = firstItem?.price?.id

      if (!priceId) {
        console.warn(
          "[subscriptions] Stripe subscription missing price id for",
          stripeSubId
        )
        break
      }

      // 3️⃣ Find our SubscriptionPlan by stripe_price_id
      const [plan] = await subscriptionModuleService.listSubscriptionPlans({
        stripe_price_id: priceId,
      })

      if (!plan) {
        console.warn(
          "[subscriptions] No SubscriptionPlan found for stripe_price_id",
          priceId
        )
        break
      }

      // 4️⃣ Idempotency: check if we already created this subscription
      const [existingSub] = await subscriptionModuleService.listSubscriptions({
        stripe_subscription_id: stripeSub.id,
      })

      if (existingSub) {
        console.log(
          "[subscriptions] Subscription already exists, skipping create:",
          stripeSub.id
        )
        break
      }

      // 5️⃣ Extract shipping snapshot for later orders
      const addr = shippingDetails?.address || customerDetails?.address || null

      const subscription = await subscriptionModuleService.createSubscriptions({
        customer_id: medusaCustomer.id,
        plan_id: plan.id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSub.id,
        stripe_latest_invoice_id: stripeSub.latest_invoice as string | null,
        status: stripeSub.status as any,
        current_period_start: stripeSub.current_period_start
          ? new Date(stripeSub.current_period_start * 1000)
          : null,
        current_period_end: stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000)
          : null,

        billing_email: email,

        shipping_name: shippingDetails?.name || null,
        shipping_phone: shippingDetails?.phone || null,

        shipping_address_line1: addr?.line1 || null,
        shipping_address_line2: addr?.line2 || null,
        shipping_city: addr?.city || null,
        shipping_province: addr?.state || null,
        shipping_postal_code: addr?.postal_code || null,
        shipping_country: addr?.country || null,

        last_order_id: null,
        last_order_created_at: null,
      })

      console.log(
        "[subscriptions] Created subscription",
        subscription.id,
        "for customer",
        medusaCustomer.email,
        "plan",
        plan.id
      )

      break
    }

    /**
     * Subscription renewed successfully (Stripe charged the customer)
     * We'll update the period & invoice info now, and later plug in order creation.
     */
    case "invoice.payment_succeeded": {
      const invoiceAny = event.data.object as any

      if (invoiceAny.billing_reason !== "subscription_cycle") {
        break
      }

      const stripeSubId = invoiceAny.subscription as string | null
      if (!stripeSubId) {
        console.warn(
          "[subscriptions] invoice.payment_succeeded missing subscription id"
        )
        break
      }

      // 1️⃣ Find our subscription row
      const [sub] = await subscriptionModuleService.listSubscriptions({
        stripe_subscription_id: stripeSubId,
      })

      if (!sub) {
        console.warn(
          "[subscriptions] invoice.payment_succeeded for unknown subscription",
          stripeSubId
        )
        break
      }

      const line = invoiceAny.lines?.data?.[0]
      const period = line?.period

      // 2️⃣ Update latest invoice + period
      await subscriptionModuleService.updateSubscriptions(
        { id: sub.id },
        {
          stripe_latest_invoice_id: invoiceAny.id,
          status: "active",
          current_period_start: period
            ? new Date(period.start * 1000)
            : sub.current_period_start,
          current_period_end: period
            ? new Date(period.end * 1000)
            : sub.current_period_end,
        }
      )

      console.log(
        "[subscriptions] Updated subscription after invoice.payment_succeeded",
        sub.id,
        "invoice",
        invoiceAny.id
      )

      // 3️⃣ Later we’ll create a Medusa Order here using product + customer + address

      break
    }

    default: {
      // ignore other events for now
      break
    }
  }

  return res.json({ received: true })
}