// src/api/hooks/stripe/subscriptions/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Stripe from "stripe"
import SubscriptionModuleService from "../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../modules/subscription"
import { Modules } from "@medusajs/framework/utils"
import type { ICustomerModuleService } from "@medusajs/framework/types"

const stripe = new Stripe(process.env.STRIPE_API_KEY!)

// Optional fallbacks – set these in Railway if you want
const SUBSCRIPTIONS_SALES_CHANNEL_ID =
  process.env.SUBSCRIPTIONS_SALES_CHANNEL_ID || undefined
const SUBSCRIPTIONS_REGION_ID =
  process.env.SUBSCRIPTIONS_REGION_ID || undefined

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
    // Preferred: verify signature using raw body
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
    // Fallback: no raw body, skip signature verification
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

  //
  // Helper: find or create Medusa customer and attach stripe_customer_id
  //
  const ensureMedusaCustomer = async (opts: {
    email: string
    name: string
    stripeCustomerId: string
  }) => {
    const { email, name, stripeCustomerId } = opts

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
        "[subscriptions] Created Medusa customer",
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
          "[subscriptions] Attached stripe_customer_id to existing customer",
          medusaCustomer.id
        )
      }
    }

    return medusaCustomer
  }

  switch (event.type) {
    //
    // 1) CHECKOUT SESSION COMPLETED → create subscription row
    //
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

      const medusaCustomer = await ensureMedusaCustomer({
        email,
        name,
        stripeCustomerId,
      })

      // Load Stripe subscription to map to our plan
      const stripeSub = (await stripe.subscriptions.retrieve(
        stripeSubId
      )) as any

      const firstItem = stripeSub.items.data[0]
      const priceId = firstItem?.price?.id

      if (!priceId) {
        console.warn(
          "[subscriptions] checkout.session.completed: missing price id",
          stripeSubId
        )
        break
      }

      console.log(
        "[subscriptions] checkout.session.completed using price_id",
        priceId
      )

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
      })

      // Idempotency: if subscription already exists, skip
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

      // Shipping snapshot
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
        "plan",
        plan.id
      )

      break
    }

    //
    // 2) SAFETY NET: customer.subscription.created
    //
    case "customer.subscription.created": {
      const stripeSub = event.data.object as any
      const stripeCustomerId = stripeSub.customer as string | null

      if (!stripeCustomerId) {
        console.warn(
          "[subscriptions] customer.subscription.created missing customer id"
        )
        break
      }

      // Idempotency
      {
        const [existingSub] = await subscriptionModuleService.listSubscriptions({
          stripe_subscription_id: stripeSub.id,
        })
        if (existingSub) {
          console.log(
            "[subscriptions] customer.subscription.created: subscription already exists, skipping"
          )
          break
        }
      }

      const stripeCustomer = (await stripe.customers.retrieve(
        stripeCustomerId
      )) as any

      const email = stripeCustomer.email as string | null
      const name = (stripeCustomer.name as string) || ""
      const shippingDetails = stripeCustomer.shipping || null

      if (!email) {
        console.warn(
          "[subscriptions] customer.subscription.created has no email"
        )
        break
      }

      const medusaCustomer = await ensureMedusaCustomer({
        email,
        name,
        stripeCustomerId,
      })

      const firstItem = stripeSub.items?.data?.[0]
      const priceId = firstItem?.price?.id

      if (!priceId) {
        console.warn(
          "[subscriptions] customer.subscription.created: missing price id",
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
          "[subscriptions] customer.subscription.created: No plan for price_id",
          priceId
        )
        break
      }

      console.log("[subscriptions] Matched SubscriptionPlan", {
        plan_id: plan.id,
        product_id: plan.product_id,
      })

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
        "plan",
        plan.id
      )

      break
    }

    //
    // 3) INVOICE PAYMENT SUCCEEDED → create order for that cycle
    //
    case "invoice.payment_succeeded": {
      const invoiceAny = event.data.object as any

      const reason = invoiceAny.billing_reason
      if (
        reason !== "subscription_create" &&
        reason !== "subscription_cycle"
      ) {
        break
      }

      // Find subscription id on the Stripe invoice
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
          { invoice_id: invoiceAny.id, billing_reason: invoiceAny.billing_reason }
        )
        break
      }

      // Find our local subscription
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

      // Idempotency: already processed this invoice?
      if (sub.stripe_latest_invoice_id === invoiceAny.id && sub.last_order_id) {
        console.log(
          "[subscriptions] Invoice already processed for subscription",
          sub.id,
          "invoice",
          invoiceAny.id
        )
        break
      }

      // Load plan (so we know which product to attach)
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
      })

      const line = invoiceAny.lines?.data?.[0]
      const period = line?.period

      const currency = (invoiceAny.currency as string).toLowerCase()
      let createdOrder: any | null = null

      try {
        const orderModule = req.scope.resolve<any>(Modules.ORDER)
        const productModule = req.scope.resolve<any>(Modules.PRODUCT)
        const regionModule = req.scope.resolve<any>(Modules.REGION)

        // 1) Load product with variants + prices + sales channels
        let product: any | null = null
        let variantId: string | undefined
        let salesChannelId: string | undefined
        let regionId: string | undefined
        let lineTitle = "Subscription order"
        let unitPrice: number

        product = await productModule.retrieveProduct(plan.product_id, {
          relations: ["variants", "variants.prices", "sales_channels"],
        })

        console.log("[subscriptions] Loaded product for plan", {
          plan_id: plan.id,
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

        // Choose variant + price from Medusa (NOT Stripe)
        if (Array.isArray(product?.variants) && product.variants.length > 0) {
          const variant = product.variants[0] // adjust if you want specific variant per plan
          variantId = variant.id

          const prices = (variant as any).prices || []
          const variantPrice =
            prices.find((p: any) => p.currency_code === currency) ?? prices[0]

          if (!variantPrice) {
            throw new Error(
              `No price found for variant ${variantId} in currency ${currency}`
            )
          }

          // Medusa expects minor units (e.g. cents)
          unitPrice = variantPrice.amount

          console.log("[subscriptions] Using Medusa variant price", {
            variant_id: variantId,
            currency,
            unit_price: unitPrice,
          })
        } else {
          throw new Error(
            `Product ${plan.product_id} has no variants – cannot create order`
          )
        }

        // Optional: log Stripe price for debugging only
        const stripeUnitAmountCents = line?.price?.unit_amount ?? null
        console.log("[subscriptions] Stripe vs Medusa price debug", {
          stripeUnitAmountCents,
          medusaUnitPrice: unitPrice,
        })

        if (
          Array.isArray(product?.sales_channels) &&
          product.sales_channels.length > 0
        ) {
          salesChannelId = product.sales_channels[0].id
        }

        // 2) Sales channel fallback
        if (!salesChannelId && SUBSCRIPTIONS_SALES_CHANNEL_ID) {
          salesChannelId = SUBSCRIPTIONS_SALES_CHANNEL_ID
          console.log(
            "[subscriptions] Using fallback sales channel",
            salesChannelId
          )
        }

        if (!salesChannelId) {
          throw new Error(
            "No sales channel found – set SUBSCRIPTIONS_SALES_CHANNEL_ID or attach product to a sales channel"
          )
        }

        // 3) Resolve region by shipping country
        const countryCode = sub.shipping_country?.toLowerCase()

        if (countryCode) {
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
        }

        if (!regionId) {
          if (SUBSCRIPTIONS_REGION_ID) {
            regionId = SUBSCRIPTIONS_REGION_ID
            console.log("[subscriptions] Using fallback region", regionId)
          } else {
            const allRegions = await regionModule.listRegions({ take: 1 })
            if (allRegions && allRegions.length > 0) {
              regionId = allRegions[0].id
              console.log(
                "[subscriptions] Using first available region",
                regionId
              )
            }
          }
        }

        if (!regionId) {
          throw new Error(
            "No region found – set SUBSCRIPTIONS_REGION_ID or ensure region supports the shipping country"
          )
        }

        // Country code must be 2-char ISO
        let validCountryCode = countryCode
        if (!validCountryCode || validCountryCode.length !== 2) {
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
          unit_price: unitPrice,
          country_code: validCountryCode,
        })

        // 4) Build order payload
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
              unit_price: unitPrice, // Medusa variant price (minor units)
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
            country_code: validCountryCode,
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

        // 5) Mark order as paid (since Stripe already charged)
        try {
          const orderTotal =
            createdOrder?.total ?? createdOrder?.subtotal ?? unitPrice

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

      // Update subscription regardless of whether order succeeded
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
