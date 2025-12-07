// src/api/hooks/stripe/subscriptions/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Stripe from "stripe"
import SubscriptionModuleService from "../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../modules/subscription"
import { Modules } from "@medusajs/framework/utils"
import type { ICustomerModuleService } from "@medusajs/framework/types"

const stripe = new Stripe(process.env.STRIPE_API_KEY!)

// Small helper to find-or-create a Medusa customer by email
async function getOrCreateMedusaCustomer(opts: {
  customerModuleService: ICustomerModuleService
  email: string
  name?: string | null
  stripeCustomerId: string
}) {
  const { customerModuleService, email, name, stripeCustomerId } = opts

  const [existing] = await customerModuleService.listCustomers({ email })

  let medusaCustomer = existing

  if (!medusaCustomer) {
    const fullName = name || ""
    const [first_name, ...rest] = fullName.split(" ")
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
    const metadata = (medusaCustomer.metadata || {}) as Record<string, unknown>
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

  return medusaCustomer
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const sig = req.headers["stripe-signature"] as string | undefined
  const webhookSecret = process.env.STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    console.error(
      "[subscriptions] Missing Stripe signature or STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET"
    )
    return res.status(400).send("Missing Stripe signature or webhook secret")
  }

  let event: Stripe.Event

  if (req.rawBody) {
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret)
    } catch (err: any) {
      console.error(
        "[subscriptions] Stripe webhook signature verification failed:",
        err.message
      )
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }
  } else {
    console.warn(
      "[subscriptions] rawBody missing, falling back to parsed body without signature verification"
    )
    event = req.body as unknown as Stripe.Event
  }

  const subscriptionModuleService =
    req.scope.resolve<SubscriptionModuleService>(SUBSCRIPTION_MODULE)

  const customerModuleService = req.scope.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  )

  switch (event.type) {
    /**
     * Main creation path – Payment Link / Checkout session for a subscription
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

      // 1) Ensure a Medusa customer exists
      const medusaCustomer = await getOrCreateMedusaCustomer({
        customerModuleService,
        email,
        name,
        stripeCustomerId,
      })

      // 2) Load Stripe subscription to map to our plan
      const stripeSub = (await stripe.subscriptions.retrieve(
        stripeSubId
      )) as any
      const firstItem = stripeSub.items?.data?.[0]
      const priceId = firstItem?.price?.id

      if (!priceId) {
        console.warn(
          "[subscriptions] Stripe subscription missing price id for",
          stripeSubId
        )
        break
      }

      // 3) Find our SubscriptionPlan by stripe_price_id
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

      // 4) Idempotency: if we already have this subscription, stop
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

      // 5) Snapshot shipping info
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
        "[subscriptions] Created subscription from checkout.session.completed",
        subscription.id,
        "for customer",
        medusaCustomer.email,
        "plan",
        plan.id
      )

      break
    }

    /**
     * Safety net: subscription created through some other flow
     */
    case "customer.subscription.created": {
      const stripeSub = event.data.object as any
      const stripeCustomerId = stripeSub.customer as string | null

      if (!stripeCustomerId) {
        console.warn(
          "[subscriptions] customer.subscription.created missing customer id"
        )
        break
      }

      // 1) Idempotency
      {
        const [existingSub] = await subscriptionModuleService.listSubscriptions({
          stripe_subscription_id: stripeSub.id,
        })
        if (existingSub) {
          console.log(
            "[subscriptions] customer.subscription.created: subscription already exists, skipping create:",
            stripeSub.id
          )
          break
        }
      }

      // 2) Load Stripe customer
      const stripeCustomer = (await stripe.customers.retrieve(
        stripeCustomerId
      )) as any

      const email = stripeCustomer.email as string | null
      const name = (stripeCustomer.name as string) || ""
      const shippingDetails = stripeCustomer.shipping || null

      if (!email) {
        console.warn(
          "[subscriptions] customer.subscription.created has no email, cannot create Medusa customer"
        )
        break
      }

      // 3) Ensure Medusa customer exists
      const medusaCustomer = await getOrCreateMedusaCustomer({
        customerModuleService,
        email,
        name,
        stripeCustomerId,
      })

      // 4) Map subscription item → SubscriptionPlan
      const firstItem = stripeSub.items?.data?.[0]
      const priceId = firstItem?.price?.id

      if (!priceId) {
        console.warn(
          "[subscriptions] customer.subscription.created: missing price id for subscription",
          stripeSub.id
        )
        break
      }

      const [plan] = await subscriptionModuleService.listSubscriptionPlans({
        stripe_price_id: priceId,
      })

      if (!plan) {
        console.warn(
          "[subscriptions] customer.subscription.created: No SubscriptionPlan found for stripe_price_id",
          priceId
        )
        break
      }

      const addr = shippingDetails?.address || null

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
        "[subscriptions] Created subscription from customer.subscription.created",
        subscription.id,
        "for customer",
        medusaCustomer.email,
        "plan",
        plan.id
      )

      break
    }

    /**
     * Subscription billed successfully → create order + mark as paid
     */
    case "invoice.payment_succeeded": {
      const invoiceAny = event.data.object as any

      const reason = invoiceAny.billing_reason
      if (
        reason !== "subscription_create" &&
        reason !== "subscription_cycle"
      ) {
        break
      }

      // Try a few places for the subscription id
      let stripeSubId: string | null =
        (invoiceAny.subscription as string | null) ?? null

      if (!stripeSubId) {
        const firstLine = invoiceAny.lines?.data?.[0]
        stripeSubId =
          (firstLine?.subscription as string | undefined) ??
          (firstLine?.parent?.subscription_item_details?.subscription as
            string | undefined) ??
          null
      }

      if (!stripeSubId) {
        console.warn(
          "[subscriptions] invoice.payment_succeeded missing subscription id",
          {
            invoice_id: invoiceAny.id,
            billing_reason: invoiceAny.billing_reason,
          }
        )
        break
      }

      // 1) Find our subscription row
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

      // 2) Idempotency: same invoice & already has an order
      if (
        sub.stripe_latest_invoice_id === invoiceAny.id &&
        sub.last_order_id
      ) {
        console.log(
          "[subscriptions] Invoice already processed for subscription",
          sub.id,
          "invoice",
          invoiceAny.id
        )
        break
      }

      // 3) Load the plan (product + pricing)
      const [plan] = await subscriptionModuleService.listSubscriptionPlans({
        id: sub.plan_id,
      })

      if (!plan) {
        console.warn(
          "[subscriptions] Subscription has no plan for plan_id",
          sub.plan_id
        )
      }

      const line = invoiceAny.lines?.data?.[0]
      const period = line?.period

      // Decide price (in cents) + currency
      let unitAmountCents: number | null =
        plan && typeof plan.unit_amount === "number"
          ? plan.unit_amount
          : null

      if (
        unitAmountCents == null &&
        typeof invoiceAny.amount_paid === "number"
      ) {
        unitAmountCents = invoiceAny.amount_paid // Stripe sends cents
      }

      let currency: string | null =
        plan && plan.currency ? plan.currency.toLowerCase() : null

      if (!currency && typeof invoiceAny.currency === "string") {
        currency = invoiceAny.currency.toLowerCase()
      }

      // 4) Create order if we have enough info
      let createdOrder: any | null = null

      if (plan && unitAmountCents != null && currency) {
        try {
          const orderModule = req.scope.resolve<any>(Modules.ORDER)

          let product: any | null = null
          let variantId: string | undefined
          let salesChannelId: string | undefined
          let lineTitle = plan.name ?? "Subscription"

          try {
            const productModule = req.scope.resolve<any>(Modules.PRODUCT)
            product = await productModule.retrieveProduct(plan.product_id)

            if (product?.title) {
              lineTitle = product.title
            }

            if (
              Array.isArray(product?.variants) &&
              product.variants.length > 0
            ) {
              variantId = product.variants[0].id
            }

            if (
              Array.isArray(product?.sales_channels) &&
              product.sales_channels.length > 0
            ) {
              salesChannelId = product.sales_channels[0].id
            }
          } catch (e) {
            console.warn(
              "[subscriptions] Could not load product for plan",
              plan.id,
              "product_id",
              plan.product_id,
              e
            )
          }

          const orderInput: any = {
            customer_id: sub.customer_id, // ✅ same Medusa customer as subscription
            email: sub.billing_email ?? undefined,
            currency_code: currency,
            sales_channel_id: salesChannelId, // can be undefined

            items: [
              {
                title: lineTitle,
                product_id: plan.product_id,
                variant_id: variantId,
                quantity: 1,
                // Medusa stores prices in smallest currency unit (cents)
                unit_price: unitAmountCents,
              },
            ],

            shipping_address: {
              first_name: sub.shipping_name ?? undefined,
              last_name: undefined,
              phone: sub.shipping_phone ?? undefined,
              address_1: sub.shipping_address_line1 ?? undefined,
              address_2: sub.shipping_address_line2 ?? undefined,
              city: sub.shipping_city ?? undefined,
              province: sub.shipping_province ?? undefined,
              postal_code: sub.shipping_postal_code ?? undefined,
              country_code: sub.shipping_country
                ? sub.shipping_country.toLowerCase()
                : undefined,
            },

            metadata: {
              subscription_id: sub.id,
              stripe_subscription_id: stripeSubId,
              stripe_invoice_id: invoiceAny.id,
              stripe_customer_id: sub.stripe_customer_id,
              subscription_plan_name: plan.name,
            },
          }

          const result = await orderModule.createOrders(orderInput)
          createdOrder = Array.isArray(result) ? result[0] : result

          // Mark order as paid
          try {
            const orderTotal =
              createdOrder?.total ??
              createdOrder?.subtotal ??
              unitAmountCents

            if (orderTotal != null) {
              await orderModule.updateOrders(
                { id: createdOrder.id },
                {
                  paid_total: orderTotal,
                  payment_status: "captured",
                }
              )
            }
          } catch (markPaidErr) {
            console.warn(
              "[subscriptions] Failed to mark order as paid",
              createdOrder?.id,
              markPaidErr
            )
          }

          console.log(
            "[subscriptions] Created order",
            createdOrder?.id,
            "for subscription",
            sub.id,
            "invoice",
            invoiceAny.id
          )
        } catch (err) {
          console.error(
            "[subscriptions] Failed to create order from subscription",
            sub.id,
            "invoice",
            invoiceAny.id,
            err
          )
        }
      } else {
        console.warn(
          "[subscriptions] Skipping order creation - missing plan/price/currency",
          {
            hasPlan: !!plan,
            unitAmountCents,
            currency,
            subscription_id: sub.id,
            invoice_id: invoiceAny.id,
          }
        )
      }

      // 5) Update subscription record
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
          last_order_id: createdOrder?.id ?? sub.last_order_id,
          last_order_created_at: createdOrder
            ? new Date()
            : sub.last_order_created_at,
        }
      )

      break
    }

    default: {
      break
    }
  }

  return res.json({ received: true })
}