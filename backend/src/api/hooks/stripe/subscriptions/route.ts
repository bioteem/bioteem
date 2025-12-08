// src/api/hooks/stripe/subscriptions/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Stripe from "stripe"
import SubscriptionModuleService from "../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../modules/subscription"
import { Modules } from "@medusajs/framework/utils"
import type { ICustomerModuleService } from "@medusajs/framework/types"

const stripe = new Stripe(process.env.STRIPE_API_KEY!)

// Fallback configurations
const SUBSCRIPTIONS_SALES_CHANNEL_ID = process.env.SUBSCRIPTIONS_SALES_CHANNEL_ID
const SUBSCRIPTIONS_REGION_ID = process.env.SUBSCRIPTIONS_REGION_ID

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
     * Customer completed a Payment Link checkout for a subscription
     * (primary creation path for our local Subscription row)
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

        console.log(
          "[subscriptions] Created Medusa customer from checkout.session.completed",
          medusaCustomer.id,
          email
        )
      } else {
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
          console.log(
            "[subscriptions] Attached stripe_customer_id to existing Medusa customer",
            medusaCustomer.id
          )
        }
      }

      // 2️⃣ Load the Stripe Subscription (for price → plan mapping)
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

      console.log(
        "[subscriptions] checkout.session.completed using price_id",
        priceId
      )

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

      console.log("[subscriptions] Matched SubscriptionPlan", {
        plan_id: plan.id,
        product_id: plan.product_id,
        unit_amount: (plan as any).unit_amount,
        currency: (plan as any).currency,
      })

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
     * SAFETY NET CREATION – subscription made in other Stripe flows
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

      // 1️⃣ Idempotency
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

      // 2️⃣ Load Stripe customer
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

      // 3️⃣ Find or create Medusa customer
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

        console.log(
          "[subscriptions] Created Medusa customer from customer.subscription.created",
          medusaCustomer.id,
          email
        )
      } else {
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

      // 4️⃣ Determine price and map to SubscriptionPlan
      const firstItem = stripeSub.items?.data?.[0]
      const priceId = firstItem?.price?.id

      if (!priceId) {
        console.warn(
          "[subscriptions] customer.subscription.created: missing price id for subscription",
          stripeSub.id
        )
        break
      }

      console.log(
        "[subscriptions] customer.subscription.created using price_id",
        priceId
      )

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

      console.log("[subscriptions] Matched SubscriptionPlan", {
        plan_id: plan.id,
        product_id: plan.product_id,
        unit_amount: (plan as any).unit_amount,
        currency: (plan as any).currency,
      })

      // 5️⃣ Shipping snapshot from Stripe customer
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
     * Subscription invoice paid -> match to our Subscription, then:
     *   Subscription → Plan → Product → Order
     * All price/currency comes from the SubscriptionPlan, not Stripe invoice.
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

      // 🔍 subscription id can live in a few places (Stripe keeps changing shapes)
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

      // 1️⃣ Find our local subscription row
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

      // 2️⃣ Idempotency guard
      if (sub.stripe_latest_invoice_id === invoiceAny.id && sub.last_order_id) {
        console.log(
          "[subscriptions] Invoice already processed for subscription",
          sub.id,
          "invoice",
          invoiceAny.id
        )
        break
      }

      // 3️⃣ Load the plan (this is our source of truth for price & product)
      const [plan] = await subscriptionModuleService.listSubscriptionPlans({
        id: sub.plan_id,
      })

      if (!plan) {
        console.warn(
          "[subscriptions] Subscription has no plan for plan_id",
          sub.plan_id
        )
        break
      }

      console.log("[subscriptions] invoice.payment_succeeded plan info", {
        plan_id: plan.id,
        product_id: plan.product_id,
        unit_amount: (plan as any).unit_amount,
        currency: (plan as any).currency,
      })

      const line = invoiceAny.lines?.data?.[0]
      const period = line?.period

      // ⚖️ Price & currency: STRICTLY from plan
      const unitAmountRaw = (plan as any).unit_amount
      const currencyRaw = (plan as any).currency

      if (
        typeof unitAmountRaw !== "number" ||
        !Number.isFinite(unitAmountRaw)
      ) {
        console.warn(
          "[subscriptions] Plan has no valid unit_amount, cannot create order",
          {
            plan_id: plan.id,
            unit_amount: unitAmountRaw,
          }
        )
        break
      }

      if (!currencyRaw || typeof currencyRaw !== "string") {
        console.warn(
          "[subscriptions] Plan has no currency, cannot create order",
          {
            plan_id: plan.id,
            currency: currencyRaw,
          }
        )
        break
      }

      const unitAmount: number = unitAmountRaw // cents
      const currency: string = currencyRaw.toLowerCase()

      let createdOrder: any | null = null

      try {
        const orderModule = req.scope.resolve<any>(Modules.ORDER)
        const productModule = req.scope.resolve<any>(Modules.PRODUCT)
        const regionModule = req.scope.resolve<any>(Modules.REGION)

        // 🔍 Step 1: Load the product with relations
        let product: any | null = null
        let variantId: string | undefined
        let salesChannelId: string | undefined
        let regionId: string | undefined
        let lineTitle = plan.name ?? "Subscription"

        try {
          product = await productModule.retrieveProduct(plan.product_id, {
            relations: ["variants", "sales_channels"],
          })

          console.log("[subscriptions] Loaded product for plan", {
            product_id: plan.product_id,
            title: product?.title,
            variants_count: Array.isArray(product?.variants)
              ? product.variants.length
              : "n/a",
            sales_channels: Array.isArray(product?.sales_channels)
              ? product.sales_channels.map((sc: any) => sc.id)
              : "n/a",
          })

          if (product?.title) {
            lineTitle = product.title
          }

          // Get first available variant
          if (
            Array.isArray(product?.variants) &&
            product.variants.length > 0
          ) {
            variantId = product.variants[0].id
          } else {
            console.warn(
              "[subscriptions] Product has no variants",
              plan.product_id
            )
          }

          // Get first sales channel
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

        // 🔍 Step 2: Determine sales channel (with fallback)
        if (!salesChannelId && SUBSCRIPTIONS_SALES_CHANNEL_ID) {
          salesChannelId = SUBSCRIPTIONS_SALES_CHANNEL_ID
          console.log(
            "[subscriptions] Using fallback sales channel",
            salesChannelId
          )
        }

        // 🔍 Step 3: Determine region based on country code
        const countryCode = sub.shipping_country?.toLowerCase()

        if (countryCode) {
          try {
            const regions = await regionModule.listRegions({
              countries: { iso_2: countryCode },
            })

            if (regions && regions.length > 0) {
              regionId = regions[0].id
              console.log(
                "[subscriptions] Found region for country",
                countryCode,
                "->",
                regionId
              )
            }
          } catch (e) {
            console.warn(
              "[subscriptions] Failed to find region for country",
              countryCode,
              e
            )
          }
        }

        // Fallback to env or first region
        if (!regionId) {
          if (SUBSCRIPTIONS_REGION_ID) {
            regionId = SUBSCRIPTIONS_REGION_ID
            console.log("[subscriptions] Using fallback region", regionId)
          } else {
            try {
              const allRegions = await regionModule.listRegions({ take: 1 })
              if (allRegions && allRegions.length > 0) {
                regionId = allRegions[0].id
                console.log(
                  "[subscriptions] Using first available region",
                  regionId
                )
              }
            } catch (e) {
              console.warn("[subscriptions] Could not load any regions", e)
            }
          }
        }

        if (!regionId) {
          throw new Error(
            "No region found - set SUBSCRIPTIONS_REGION_ID or ensure country matches a region"
          )
        }

        if (!salesChannelId) {
          throw new Error(
            "No sales channel found - set SUBSCRIPTIONS_SALES_CHANNEL_ID or link product to a sales channel"
          )
        }

        // 🔍 Step 4: Validate country code format (must be 2-letter ISO)
        let validCountryCode = countryCode
        if (countryCode && countryCode.length !== 2) {
          console.warn(
            "[subscriptions] Invalid country code format",
            countryCode,
            "- defaulting to 'us'"
          )
          validCountryCode = "us"
        }

        console.log("[subscriptions] Building orderInput", {
          customer_id: sub.customer_id,
          email: sub.billing_email,
          currency,
          region_id: regionId,
          sales_channel_id: salesChannelId,
          product_id: plan.product_id,
          variant_id: variantId,
          unit_price: unitAmount,
          country_code: validCountryCode,
        })

        // 🔍 Step 5: Build order input using Subscription + Plan (NOT Stripe invoice amounts)
        const orderInput: any = {
          customer_id: sub.customer_id,
          email: sub.billing_email ?? undefined,
          currency_code: currency,
          region_id: regionId,
          sales_channel_id: salesChannelId,

          items: [
            {
              title: lineTitle,
              product_id: plan.product_id,
              variant_id: variantId,
              quantity: 1,
              unit_price: unitAmount, // cents from plan.unit_amount
            },
          ],

          shipping_address: {
            first_name: sub.shipping_name ?? "Subscriber",
            last_name: undefined,
            phone: sub.shipping_phone ?? undefined,
            address_1: sub.shipping_address_line1 ?? undefined,
            address_2: sub.shipping_address_line2 ?? undefined,
            city: sub.shipping_city ?? undefined,
            province: sub.shipping_province ?? undefined,
            postal_code: sub.shipping_postal_code ?? undefined,
            country_code: validCountryCode ?? "us",
          },

          metadata: {
            subscription_id: sub.id,
            stripe_subscription_id: stripeSubId,
            stripe_invoice_id: invoiceAny.id,
            stripe_customer_id: sub.stripe_customer_id,
            subscription_plan_name: plan.name,
          },
        }

        console.log(
          "[subscriptions] Final orderInput payload",
          JSON.stringify(orderInput, null, 2)
        )

        const result = await orderModule.createOrders(orderInput as any)
        createdOrder = Array.isArray(result) ? result[0] : result

        console.log(
          "[subscriptions] Created order",
          createdOrder?.id,
          "for subscription",
          sub.id,
          "invoice",
          invoiceAny.id
        )

        // 💳 Mark order as paid (still using our plan-based total)
        try {
          const orderTotal =
            createdOrder?.total ?? createdOrder?.subtotal ?? unitAmount

          if (orderTotal != null && createdOrder?.id) {
            await orderModule.updateOrders(
              { id: createdOrder.id },
              {
                paid_total: orderTotal,
                payment_status: "captured",
              }
            )
            console.log(
              "[subscriptions] Marked order as paid",
              createdOrder.id,
              "paid_total",
              orderTotal
            )
          } else {
            console.warn(
              "[subscriptions] Could not mark order as paid – missing total or id",
              {
                order_id: createdOrder?.id,
                order_total: orderTotal,
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
      } catch (err) {
        console.error(
          "[subscriptions] Failed to create order from subscription",
          sub.id,
          "invoice",
          invoiceAny.id,
          err
        )
      }

      // 6️⃣ Update subscription invoice + period + last order if created
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