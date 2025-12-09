// src/api/hooks/stripe/subscriptions/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Stripe from "stripe"
import SubscriptionModuleService from "../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../modules/subscription"
import { Modules } from "@medusajs/framework/utils"
import type { ICustomerModuleService } from "@medusajs/framework/types"

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  apiVersion: process.env.STRIPE_API_VERSION as any,
})

// Optional fallbacks / config – set these in Railway
const SUBSCRIPTIONS_SALES_CHANNEL_ID =
  process.env.SUBSCRIPTIONS_SALES_CHANNEL_ID || undefined
const SUBSCRIPTIONS_REGION_ID =
  process.env.SUBSCRIPTIONS_REGION_ID || undefined
const SUBSCRIPTIONS_SHIPPING_OPTION_ID =
  process.env.SUBSCRIPTIONS_SHIPPING_OPTION_ID || undefined

// System default payment provider id
const SUBSCRIPTIONS_PAYMENT_PROVIDER_ID =
  process.env.SUBSCRIPTIONS_PAYMENT_PROVIDER_ID || "pp_system_default"

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

      // Idempotency
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

      const [existingSub] = await subscriptionModuleService.listSubscriptions({
        stripe_subscription_id: stripeSub.id,
      })
      if (existingSub) {
        console.log(
          "[subscriptions] customer.subscription.created: subscription already exists, skipping"
        )
        break
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
    // 3) INVOICE PAYMENT SUCCEEDED → use cart workflow to create order
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

      // Stripe subscription id on invoice
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

      const firstLine = invoiceAny.lines?.data?.[0]
      const period = firstLine?.period

      // Price from Stripe (cents → major) – used for metadata and sanity,
      // but the actual line-item price will come from the variant / price list.
      let stripeUnitAmountCents: number | null =
        firstLine?.price?.unit_amount ?? null

      if (
        stripeUnitAmountCents == null &&
        typeof invoiceAny.amount_paid === "number"
      ) {
        const qty = firstLine?.quantity ?? 1
        stripeUnitAmountCents = Math.round(invoiceAny.amount_paid / qty)
      }

      if (stripeUnitAmountCents == null) {
        console.warn(
          "[subscriptions] Could not determine Stripe unit amount for invoice",
          invoiceAny.id
        )
        break
      }

      const unitPriceFromStripe = Math.round(stripeUnitAmountCents / 100)
      const currency = (invoiceAny.currency as string).toLowerCase()

      let createdOrder: any | null = null

      try {
        const productModule = req.scope.resolve<any>(Modules.PRODUCT)
        const regionModule = req.scope.resolve<any>(Modules.REGION)
        const cartModule = req.scope.resolve<any>(Modules.CART)
        const orderModule = req.scope.resolve<any>(Modules.ORDER)

        // Import core flows at runtime to avoid circular deps
        const coreFlows = await import("@medusajs/medusa/core-flows")
        const { addToCartWorkflow } = coreFlows
        const { createPaymentCollectionForCartWorkflow } = coreFlows
        const { createPaymentSessionsWorkflow } = coreFlows
        const { completeCartWorkflow } = coreFlows

        // 1) Load product + variant
        const product = await productModule.retrieveProduct(plan.product_id, {
          relations: ["variants"],
        })

        if (!product || !Array.isArray(product.variants) || !product.variants.length) {
          throw new Error(
            `Product ${plan.product_id} has no variants – cannot create cart`
          )
        }

        const variantId: string = product.variants[0].id
        let salesChannelId: string | undefined = undefined
        let regionId: string | undefined = undefined

        if (SUBSCRIPTIONS_SALES_CHANNEL_ID) {
          salesChannelId = SUBSCRIPTIONS_SALES_CHANNEL_ID
        }

        // 2) Resolve region (by shipping country, fallback to env, then first region)
        const countryCode = sub.shipping_country?.toLowerCase()

        if (countryCode) {
          const regions = await regionModule.listRegions({
            countries: { iso_2: countryCode },
          })
          if (regions?.length) {
            regionId = regions[0].id
            console.log(
              "[subscriptions] Found region for country",
              countryCode,
              "->",
              regionId
            )
          }
        }

        if (!regionId && SUBSCRIPTIONS_REGION_ID) {
          regionId = SUBSCRIPTIONS_REGION_ID
          console.log("[subscriptions] Using fallback region", regionId)
        }

        if (!regionId) {
          const allRegions = await regionModule.listRegions({ take: 1 })
          if (allRegions?.length) {
            regionId = allRegions[0].id
            console.log(
              "[subscriptions] Using first available region",
              regionId
            )
          }
        }

        if (!regionId) {
          throw new Error(
            "No region found – set SUBSCRIPTIONS_REGION_ID or ensure region supports the shipping country"
          )
        }

        let validCountryCode = countryCode
        if (!validCountryCode || validCountryCode.length !== 2) {
          validCountryCode = "us"
        }

        // 3) Create cart (with shipping address + optional shipping method)
        const cartInput: any = {
          region_id: regionId,
          sales_channel_id: salesChannelId,
          email: sub.billing_email ?? undefined,
          customer_id: sub.customer_id,
          currency_code: currency,

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
            stripe_unit_price: unitPriceFromStripe,
          },
        }

        if (SUBSCRIPTIONS_SHIPPING_OPTION_ID) {
          cartInput.shipping_methods = [
            {
              shipping_option_id: SUBSCRIPTIONS_SHIPPING_OPTION_ID,
              amount: 0, // free shipping
            },
          ]
        }

        const cart = await cartModule.createCarts(cartInput)

        console.log(
          "[subscriptions] Created cart",
          cart.id,
          "for subscription",
          sub.id
        )

        // 4) Add subscription line item (using standard addToCartWorkflow)
        await addToCartWorkflow(req.scope).run({
          input: {
            cart_id: cart.id,
            items: [
              {
                variant_id: variantId,
                quantity: 1,
                // NOTE: we are not overriding price here; Medusa will use the
                // variant's price. If you want the exact Stripe price, we can
                // later introduce a custom add-to-cart workflow that sets
                // is_custom_price + unit_price.
              },
            ],
          },
        })

        console.log(
          "[subscriptions] Added variant to cart",
          variantId,
          "cart",
          cart.id
        )

        // 5) Create payment collection + payment session (system default)
        const { result: paymentCollection } =
          await createPaymentCollectionForCartWorkflow(req.scope).run({
            input: {
              cart_id: cart.id,
            },
          })

        await createPaymentSessionsWorkflow(req.scope).run({
          input: {
            payment_collection_id: paymentCollection.id,
            provider_id: SUBSCRIPTIONS_PAYMENT_PROVIDER_ID,
            data: {
              stripe_invoice_id: invoiceAny.id,
              stripe_subscription_id: stripeSubId,
              already_paid: true,
            },
          },
        })

        console.log(
          "[subscriptions] Created payment collection + session for cart",
          cart.id
        )

        // 6) Complete cart → creates order + reservations + payment
        const { result: completed } = await completeCartWorkflow(
          req.scope
        ).run({
          input: {
            id: cart.id,
          },
        })

        createdOrder = completed

        console.log(
          "[subscriptions] Created order via cart workflow",
          createdOrder?.id,
          "for subscription",
          sub.id,
          "invoice",
          invoiceAny.id
        )
      } catch (err) {
        console.error(
          "[subscriptions] Failed to create order via cart workflow",
          sub.id,
          "invoice",
          invoiceAny.id,
          err
        )
      }

      // 7) Update subscription regardless of whether order succeeded
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