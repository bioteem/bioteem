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
const SUBSCRIPTIONS_REGION_ID = process.env.SUBSCRIPTIONS_REGION_ID || undefined
const SUBSCRIPTIONS_SHIPPING_OPTION_ID =
  process.env.SUBSCRIPTIONS_SHIPPING_OPTION_ID || undefined

// System default payment provider id
const SUBSCRIPTIONS_PAYMENT_PROVIDER_ID =
  process.env.SUBSCRIPTIONS_PAYMENT_PROVIDER_ID || "pp_system_default"


  
type AnyObj = Record<string, any>

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
  // Helpers
  //
  const getFirstPriceIdFromStripeSub = (stripeSub: AnyObj): string | null => {
    return stripeSub?.items?.data?.[0]?.price?.id ?? null
  }

  const normalizeCountryCode2 = (cc: string | null | undefined) => {
    if (!cc) return null
    const s = cc.toLowerCase().trim()
    return s.length === 2 ? s : null
  }

  const extractStripeSubIdFromInvoice = (invoiceAny: AnyObj): string | null => {
    let stripeSubId: string | null =
      (invoiceAny.subscription as string | null) ?? null

    if (!stripeSubId) {
      const firstLine = invoiceAny.lines?.data?.[0]
      stripeSubId =
        (firstLine?.subscription as string | undefined) ??
        (firstLine?.parent?.subscription_item_details?.subscription as
          | string
          | undefined) ??
        null
    }

    return stripeSubId
  }

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
      const [first_name, ...rest] = (name || "").split(" ")
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
        console.log(
          "[subscriptions] Attached stripe_customer_id to existing customer",
          medusaCustomer.id
        )
      }
    }

    return medusaCustomer
  }

  const upsertSubscriptionFromStripeSub = async (stripeSub: AnyObj) => {
    const stripeSubId = stripeSub.id as string
    const stripeCustomerId = stripeSub.customer as string | null

    if (!stripeCustomerId) {
      console.warn("[subscriptions] Stripe subscription missing customer id")
      return null
    }

    // Resolve customer details from Stripe (email/name/shipping)
    const stripeCustomer = (await stripe.customers.retrieve(
      stripeCustomerId
    )) as AnyObj

    const email = (stripeCustomer.email as string | null) ?? null
    const name = (stripeCustomer.name as string) || ""
    const shippingDetails = stripeCustomer.shipping || null
    const addr = shippingDetails?.address || null

    if (!email) {
      console.warn("[subscriptions] Stripe customer has no email", stripeCustomerId)
      return null
    }

    const medusaCustomer = await ensureMedusaCustomer({
      email,
      name,
      stripeCustomerId,
    })

    const priceId = getFirstPriceIdFromStripeSub(stripeSub)
    if (!priceId) {
      console.warn("[subscriptions] Missing price id on Stripe subscription", stripeSubId)
      return null
    }

    const [plan] = await subscriptionModuleService.listSubscriptionPlans({
      stripe_price_id: priceId,
    })

    if (!plan) {
      console.warn("[subscriptions] No SubscriptionPlan found for stripe_price_id", priceId)
      return null
    }

    const [existingSub] = await subscriptionModuleService.listSubscriptions({
      stripe_subscription_id: stripeSubId,
    })

    const payload = {
      customer_id: medusaCustomer.id,
      plan_id: plan.id,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubId,
      stripe_latest_invoice_id: (stripeSub.latest_invoice as string | null) ?? null,
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
    }

    if (!existingSub) {
      const created = await subscriptionModuleService.createSubscriptions({
        ...payload,
        last_order_id: null,
        last_order_created_at: null,
      })

      console.log("[subscriptions] Created subscription", created.id, "plan", plan.id)
      return created
    }

    await subscriptionModuleService.updateSubscriptions(
      { id: existingSub.id },
      {
        ...payload,
        // preserve last_order_id fields
        last_order_id: existingSub.last_order_id,
        last_order_created_at: existingSub.last_order_created_at,
      }
    )

    console.log(
      "[subscriptions] Updated subscription from Stripe update",
      existingSub.id,
      "plan",
      plan.id,
      "status",
      stripeSub.status
    )

    // Return the refreshed record (optional)
    const [updated] = await subscriptionModuleService.listSubscriptions({
      id: existingSub.id,
    })
    return updated || existingSub
  }

  const tagOrderAsSubscription = async (opts: {
    orderModule: any
    order: AnyObj
    sub: AnyObj
    stripeSubId: string
    stripeCustomerId: string | null
    stripeInvoiceId: string
  }) => {
    const { orderModule, order, sub, stripeSubId, stripeCustomerId, stripeInvoiceId } =
      opts

    if (!order?.id) return

    try {
      const existingOrderMetadata = (order.metadata || {}) as Record<string, any>

      await orderModule.updateOrders(
        { id: order.id },
        {
          metadata: {
            ...existingOrderMetadata,
            source: "subscription",
            is_subscription_order: true,
            subscription_id: sub.id,
            stripe_subscription_id: stripeSubId,
            stripe_invoice_id: stripeInvoiceId,
            stripe_customer_id: stripeCustomerId ?? sub.stripe_customer_id ?? null,
          },
        }
      )

      console.log("[subscriptions] Tagged order as subscription", order.id)
    } catch (e) {
      console.warn("[subscriptions] Failed to tag order metadata", order?.id, e)
    }
  }

  //
  // Main switch
  //
  try {
    switch (event.type) {
      //
      // 1) CHECKOUT SESSION COMPLETED → create subscription row
      //
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode !== "subscription") break

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

        await ensureMedusaCustomer({ email, name, stripeCustomerId })

        const stripeSub = (await stripe.subscriptions.retrieve(stripeSubId)) as AnyObj
        // Create if missing / update if exists (handles idempotency + correct plan)
        await upsertSubscriptionFromStripeSub(stripeSub)

        break
      }

      //
      // 2) SAFETY NET: customer.subscription.created
      //
      case "customer.subscription.created": {
        const stripeSub = event.data.object as AnyObj
        // Create/update based on Stripe subscription payload
        await upsertSubscriptionFromStripeSub(stripeSub)
        break
      }

      //
      // 3) KEEP IN SYNC: customer.subscription.updated (plan changes, status changes, etc.)
      //
      case "customer.subscription.updated": {
        const stripeSub = event.data.object as AnyObj
        await upsertSubscriptionFromStripeSub(stripeSub)
        break
      }

      //
      // 4) CANCELLATION: customer.subscription.deleted
      //
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as AnyObj
        const stripeSubId = stripeSub.id as string

        const [sub] = await subscriptionModuleService.listSubscriptions({
          stripe_subscription_id: stripeSubId,
        })

        if (!sub) {
          console.warn(
            "[subscriptions] customer.subscription.deleted for unknown subscription",
            stripeSubId
          )
          break
        }

        await subscriptionModuleService.updateSubscriptions(
          { id: sub.id },
          {
            status: "canceled" as any,
            stripe_latest_invoice_id: (stripeSub.latest_invoice as string | null) ?? sub.stripe_latest_invoice_id,
            current_period_start: stripeSub.current_period_start
              ? new Date(stripeSub.current_period_start * 1000)
              : sub.current_period_start,
            current_period_end: stripeSub.current_period_end
              ? new Date(stripeSub.current_period_end * 1000)
              : sub.current_period_end,
          }
        )

        console.log("[subscriptions] Marked subscription canceled", sub.id)
        break
      }

      //
      // 5) INVOICE PAYMENT SUCCEEDED → create order via cart workflow
      //    Handles:
      //      - subscription_create
      //      - subscription_cycle
      //      - subscription_update  (plan upgrades/downgrades that charge)
      //
      case "invoice.payment_succeeded": {
        const invoiceAny = event.data.object as AnyObj
        const reason = invoiceAny.billing_reason

        if (
          reason !== "subscription_create" &&
          reason !== "subscription_cycle" &&
          reason !== "subscription_update"
        ) {
          break
        }

        const stripeSubId = extractStripeSubIdFromInvoice(invoiceAny)
        if (!stripeSubId) {
          console.warn("[subscriptions] invoice.payment_succeeded missing subscription id", {
            invoice_id: invoiceAny.id,
            billing_reason: invoiceAny.billing_reason,
          })
          break
        }

        // Ensure our subscription row is in sync with Stripe (important for plan changes)
        let stripeSub: AnyObj | null = null
        try {
          stripeSub = (await stripe.subscriptions.retrieve(stripeSubId)) as AnyObj
          await upsertSubscriptionFromStripeSub(stripeSub)
        } catch (e) {
          console.warn("[subscriptions] Could not refresh Stripe subscription during invoice", stripeSubId, e)
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

        // Prefer plan derived from Stripe subscription price id (plan might have changed)
        let planIdToUse = sub.plan_id
        if (stripeSub) {
          const priceId = getFirstPriceIdFromStripeSub(stripeSub)
          if (priceId) {
            const [planFromStripe] =
              await subscriptionModuleService.listSubscriptionPlans({
                stripe_price_id: priceId,
              })
            if (planFromStripe?.id) planIdToUse = planFromStripe.id
          }
        }

        const [plan] = await subscriptionModuleService.listSubscriptionPlans({
          id: planIdToUse,
        })

        if (!plan) {
          console.warn("[subscriptions] Subscription has no plan for plan_id", planIdToUse)
          break
        }

 const firstLine = invoiceAny.lines?.data?.[0]
const period = firstLine?.period

const qty = (firstLine?.quantity ?? 1) as number

// Prefer the line's amount (already in cents). This matches what Stripe actually charged for the line.
const lineAmountCents: number | null =
  typeof firstLine?.amount === "number"
    ? firstLine.amount
    : typeof firstLine?.subtotal === "number"
      ? firstLine.subtotal
      : typeof firstLine?.price?.unit_amount === "number"
        ? firstLine.price.unit_amount * qty
        : typeof invoiceAny.amount_paid === "number"
          ? invoiceAny.amount_paid
          : null

if (lineAmountCents == null) {
  console.warn("[subscriptions] Could not determine Stripe line amount (cents) for invoice", invoiceAny.id)
  break
}

// Unit price in cents (Medusa expects minor units)
const unitPriceCents = Math.round(lineAmountCents / qty)
        const currency = (invoiceAny.currency as string).toLowerCase()

        let createdOrder: AnyObj | null = null

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
          const { addShippingMethodToCartWorkflow } = coreFlows

          // 1) Load product + variant
          const product = await productModule.retrieveProduct(plan.product_id, {
            relations: ["variants"],
          })

          if (
            !product ||
            !Array.isArray(product.variants) ||
            !product.variants.length
          ) {
            throw new Error(
              `Product ${plan.product_id} has no variants – cannot create cart`
            )
          }

          const variantId: string = product.variants[0].id
          const salesChannelId: string | undefined = SUBSCRIPTIONS_SALES_CHANNEL_ID

          // 2) Resolve region (by shipping country, fallback to env, then first region)
          const countryCode = normalizeCountryCode2(sub.shipping_country)

          let regionId: string | undefined = undefined

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
              console.log("[subscriptions] Using first available region", regionId)
            }
          }

          if (!regionId) {
            throw new Error(
              "No region found – set SUBSCRIPTIONS_REGION_ID or ensure region supports the shipping country"
            )
          }

          const validCountryCode = countryCode ?? "us"

          // 3) Create cart
          const cartInput: AnyObj = {
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
              // ✅ used by frontend filter
              source: "subscription",
              is_subscription_order: true,

              subscription_id: sub.id,
              stripe_subscription_id: stripeSubId,
              stripe_invoice_id: invoiceAny.id,
              stripe_customer_id: sub.stripe_customer_id,
              subscription_plan_name: plan.name,
              stripe_unit_price: unitPriceCents,
            },
          }

          const cart = await cartModule.createCarts(cartInput)

          console.log("[subscriptions] Created cart", cart.id, "for subscription", sub.id)

          // 4) Add subscription line item
await addToCartWorkflow(req.scope).run({
  input: {
    cart_id: cart.id,
    items: [
      {
        variant_id: variantId,
        quantity: qty,
        unit_price: unitPriceCents, // ✅ custom price reflected in Medusa order totals
        metadata: {
          pricing_source: "stripe_invoice",
          stripe_invoice_id: invoiceAny.id,
          stripe_subscription_id: stripeSubId,
          stripe_line_amount_cents: lineAmountCents,
          stripe_unit_price_cents: unitPriceCents,
        },
      },
    ],
  },
})

          console.log("[subscriptions] Added variant to cart", variantId, "cart", cart.id)

          // 4b) Attach shipping method (required for shippable items)
          if (SUBSCRIPTIONS_SHIPPING_OPTION_ID) {
            await addShippingMethodToCartWorkflow(req.scope).run({
              input: {
                cart_id: cart.id,
                options: [{ id: SUBSCRIPTIONS_SHIPPING_OPTION_ID }],
              },
            })

            console.log(
              "[subscriptions] Attached shipping method",
              SUBSCRIPTIONS_SHIPPING_OPTION_ID,
              "to cart",
              cart.id
            )
          }

          // 5) Payment collection + session
          const { result: paymentCollection } =
            await createPaymentCollectionForCartWorkflow(req.scope).run({
              input: { cart_id: cart.id },
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

          console.log("[subscriptions] Created payment collection + session for cart", cart.id)

          // 6) Complete cart → creates order
          const { result: completed } = await completeCartWorkflow(req.scope).run({
            input: { id: cart.id },
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

          // ✅ Force-tag the order (guarantees it exists even if cart->order metadata differs)
          await tagOrderAsSubscription({
            orderModule,
            order: createdOrder,
            sub,
            stripeSubId,
            stripeCustomerId: sub.stripe_customer_id,
            stripeInvoiceId: invoiceAny.id,
          })
        } catch (err) {
          console.error(
            "[subscriptions] Failed to create order via cart workflow",
            sub.id,
            "invoice",
            invoiceAny.id,
            err
          )
        }

        // 7) Update subscription regardless
        await subscriptionModuleService.updateSubscriptions(
          { id: sub.id },
          {
            stripe_latest_invoice_id: invoiceAny.id,
            status: "active" as any,
            // if plan changed, store it
            plan_id: plan.id,
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

      //
      // 6) INVOICE PAYMENT FAILED → mark subscription as past_due (or whatever you prefer)
      //
      case "invoice.payment_failed": {
        const invoiceAny = event.data.object as AnyObj
        const stripeSubId = extractStripeSubIdFromInvoice(invoiceAny)

        if (!stripeSubId) break

        const [sub] = await subscriptionModuleService.listSubscriptions({
          stripe_subscription_id: stripeSubId,
        })

        if (!sub) break

        await subscriptionModuleService.updateSubscriptions(
          { id: sub.id },
          {
            status: "past_due" as any,
            stripe_latest_invoice_id: invoiceAny.id ?? sub.stripe_latest_invoice_id,
          }
        )

        console.log("[subscriptions] Marked subscription past_due", sub.id)
        break
      }

      default: {
        break
      }
    }
  } catch (e) {
    console.error("[subscriptions] Unhandled webhook processing error", event.type, e)
    // Still return 200 to Stripe only if you truly want to swallow errors.
    // Usually better to return 500 so Stripe retries.
    return res.status(500).json({ received: true, error: "webhook_failed" })
  }

  return res.json({ received: true })
}
