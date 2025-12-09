// src/api/hooks/stripe/subscriptions/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import Stripe from "stripe"
import SubscriptionModuleService from "../../../../modules/subscription/service"
import { SUBSCRIPTION_MODULE } from "../../../../modules/subscription"
import { Modules } from "@medusajs/framework/utils"
import type { ICustomerModuleService } from "@medusajs/framework/types"

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  // @ts-ignore – keep default API version if not set
  apiVersion: process.env.STRIPE_API_VERSION as any,
})

// Optional fallbacks / config – set these in Railway
const SUBSCRIPTIONS_SALES_CHANNEL_ID =
  process.env.SUBSCRIPTIONS_SALES_CHANNEL_ID || undefined
const SUBSCRIPTIONS_REGION_ID =
  process.env.SUBSCRIPTIONS_REGION_ID || undefined
const SUBSCRIPTIONS_SHIPPING_OPTION_ID =
  process.env.SUBSCRIPTIONS_SHIPPING_OPTION_ID || undefined
const SUBSCRIPTIONS_STOCK_LOCATION_ID =
  process.env.SUBSCRIPTIONS_STOCK_LOCATION_ID || undefined

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
    // 3) INVOICE PAYMENT SUCCEEDED → create + reserve order for that cycle
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

      // Idempotency
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

      // Price from Stripe (cents → major)
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

      const unitPrice = Math.round(stripeUnitAmountCents / 100)
      const currency = (invoiceAny.currency as string).toLowerCase()

      let createdOrder: any | null = null

      try {
        const orderModule = req.scope.resolve<any>(Modules.ORDER)
        const productModule = req.scope.resolve<any>(Modules.PRODUCT)
        const regionModule = req.scope.resolve<any>(Modules.REGION)
        const inventoryModule = req.scope.resolve<any>(Modules.INVENTORY)

        if (!SUBSCRIPTIONS_STOCK_LOCATION_ID) {
          console.warn(
            "[subscriptions] SUBSCRIPTIONS_STOCK_LOCATION_ID not set – reservations will not be created"
          )
        }

        if (!SUBSCRIPTIONS_SHIPPING_OPTION_ID) {
          console.warn(
            "[subscriptions] SUBSCRIPTIONS_SHIPPING_OPTION_ID not set – orders will have no shipping method"
          )
        }

        // 1) Load product with variants + sales channels
        const product = await productModule.retrieveProduct(plan.product_id, {
          relations: ["variants", "sales_channels"],
        })

        if (!product) {
          throw new Error(
            `Could not retrieve product ${plan.product_id} for subscription plan`
          )
        }

        let variantId: string | undefined
        let salesChannelId: string | undefined
        let regionId: string | undefined
        let lineTitle = product.title || "Subscription order"

        if (Array.isArray(product.variants) && product.variants.length > 0) {
          variantId = product.variants[0].id
        } else {
          throw new Error(
            `Product ${plan.product_id} has no variants – cannot create order`
          )
        }

        if (
          Array.isArray(product.sales_channels) &&
          product.sales_channels.length > 0
        ) {
          salesChannelId = product.sales_channels[0].id
        } else if (SUBSCRIPTIONS_SALES_CHANNEL_ID) {
          salesChannelId = SUBSCRIPTIONS_SALES_CHANNEL_ID
          console.log(
            "[subscriptions] Using fallback sales channel",
            salesChannelId
          )
        } else {
          throw new Error(
            "No sales channel found – attach product to a sales channel or set SUBSCRIPTIONS_SALES_CHANNEL_ID"
          )
        }

        // 2) Resolve region by shipping country with fallbacks
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

        // 3) Build order payload (with free shipping method)
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
              unit_price: unitPrice,
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

          ...(SUBSCRIPTIONS_SHIPPING_OPTION_ID && {
            shipping_methods: [
              {
                shipping_option_id: SUBSCRIPTIONS_SHIPPING_OPTION_ID,
                amount: 0, // free shipping for subscriptions
              },
            ],
          }),

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

        // 4) Create inventory reservations for each line item (if configured)
        try {
          if (!SUBSCRIPTIONS_STOCK_LOCATION_ID) {
            console.warn(
              "[subscriptions] Skipping reservation – no SUBSCRIPTIONS_STOCK_LOCATION_ID env set"
            )
          } else if (Array.isArray(createdOrder?.items)) {
            for (const item of createdOrder.items) {
              if (!item.variant_id) {
                console.warn(
                  "[subscriptions] Line item has no variant_id, cannot reserve",
                  { line_item_id: item.id }
                )
                continue
              }

              const inventoryItems = await inventoryModule.listInventoryItems({
                variant_id: [item.variant_id],
              })

              const inventoryItem = inventoryItems?.[0]

              if (!inventoryItem) {
                console.warn(
                  "[subscriptions] No inventory_item found for variant, cannot reserve",
                  {
                    variant_id: item.variant_id,
                    line_item_id: item.id,
                  }
                )
                continue
              }

              await inventoryModule.createReservationItems([
                {
                  inventory_item_id: inventoryItem.id,
                  location_id: SUBSCRIPTIONS_STOCK_LOCATION_ID,
                  quantity: item.quantity ?? 1,
                  line_item_id: item.id,
                  description: "Subscription cycle auto-reservation",
                },
              ])

              console.log(
                "[subscriptions] Created reservation for line item",
                item.id,
                "inventory_item",
                inventoryItem.id,
                "location",
                SUBSCRIPTIONS_STOCK_LOCATION_ID
              )
            }
          }
        } catch (reserveErr) {
          console.warn(
            "[subscriptions] Failed to create inventory reservation for subscription order",
            {
              order_id: createdOrder?.id,
              error: reserveErr,
            }
          )
        }

        // 5) Mark order as paid (Stripe already charged)
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

      // 6) Update subscription regardless of whether order succeeded
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