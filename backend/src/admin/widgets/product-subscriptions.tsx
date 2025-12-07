// src/admin/widgets/product-subscriptions.tsx
import { useState, useEffect } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Input,
  Text,
  Badge,
} from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import type {
  DetailWidgetProps,
  AdminProduct,
} from "@medusajs/framework/types"

type SubscriptionPlan = {
  id: string
  name: string
  interval: string | null
  interval_count: number | null
  stripe_price_id: string
  payment_link_url: string | null
  active: boolean

  // 💰 new
  unit_amount?: number | null
  currency?: string | null
}

type PlansResponse = {
  subscription_plans: SubscriptionPlan[]
}

const ProductSubscriptionsWidget = ({
  data,
}: DetailWidgetProps<AdminProduct>) => {
  const product = data
  const productId = product.id
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [interval, setInterval] =
    useState<SubscriptionPlan["interval"]>("month")
  const [intervalCount, setIntervalCount] = useState<number>(1)
  const [stripePriceId, setStripePriceId] = useState("")
  const [paymentLinkUrl, setPaymentLinkUrl] = useState("")
  const [priceAmount, setPriceAmount] = useState("") // e.g. "29.99"
  const [priceCurrency, setPriceCurrency] = useState("usd")

  // Local plans state so we can animate/remove instantly
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: plansData, isLoading, isError } = useQuery({
    queryKey: ["subscription-plans", productId],
    queryFn: async () => {
      const res = await sdk.client.fetch<PlansResponse>(
        `/admin/products/${productId}/subscription-plans`
      )
      return res
    },
  })

  // Sync local plans when query data changes
  useEffect(() => {
    if (plansData?.subscription_plans) {
      setPlans(plansData.subscription_plans)
    }
  }, [plansData])

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      return await sdk.client.fetch(
        `/admin/products/${productId}/subscription-plans`,
        {
          method: "POST",
          body: {
            name,
            interval,
            interval_count: intervalCount,
            stripe_price_id: stripePriceId,
            payment_link_url: paymentLinkUrl,
            active: true,
            unit_amount: priceAmount
              ? Math.round(parseFloat(priceAmount) * 100) // dollars → cents
              : undefined,
            currency: priceCurrency || undefined,
          },
        }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["subscription-plans", productId],
      })
      setName("")
      setStripePriceId("")
      setPaymentLinkUrl("")
      setInterval("month")
      setIntervalCount(1)
      setPriceAmount("")
      setPriceCurrency("usd")
    },
  })

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await sdk.client.fetch(
        `/admin/products/${productId}/subscription-plans/${planId}`,
        {
          method: "DELETE",
        }
      )
    },
    onSuccess: () => {
      // Just in case, refetch to stay in sync with backend
      queryClient.invalidateQueries({
        queryKey: ["subscription-plans", productId],
      })
    },
  })

  const handleDelete = (planId: string) => {
    // trigger animation
    setDeletingId(planId)

    // after animation duration, remove from local state & call API
    setTimeout(() => {
      setPlans((prev) => prev.filter((p) => p.id !== planId))

      deletePlanMutation.mutate(planId, {
        onError: () => {
          // if delete fails, refetch to recover UI
          queryClient.invalidateQueries({
            queryKey: ["subscription-plans", productId],
          })
        },
      })

      setDeletingId(null)
    }, 150) // matches transition duration below
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Subscriptions</Heading>
      </div>

      <div className="px-6 py-4 space-y-4">
        <Text className="text-ui-fg-subtle">
          Attach Stripe subscription options to{" "}
          <span className="font-medium">{product.title}</span>. Customers will
          be sent to the Stripe Payment Link for each option.
        </Text>

        {isLoading && <Text>Loading subscription plans…</Text>}
        {isError && (
          <Text className="text-ui-fg-error">
            Failed to load subscription plans.
          </Text>
        )}

        {!isLoading && plans.length === 0 && (
          <Text className="text-ui-fg-subtle">
            No subscription options yet. Add one below.
          </Text>
        )}

        {plans.length > 0 && (
          <div className="space-y-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={[
                  "flex flex-col gap-y-1 rounded-md border px-3 py-2",
                  "transition-all duration-150 ease-out",
                  deletingId === plan.id
                    ? "opacity-0 scale-95"
                    : "opacity-100 scale-100",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-x-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Text className="font-medium">{plan.name}</Text>
                    {plan.active ? (
                      <Badge size="small" color="green">
                        Active
                      </Badge>
                    ) : (
                      <Badge size="small" color="orange">
                        Inactive
                      </Badge>
                    )}
                    {plan.interval && plan.interval_count && (
                      <Text className="text-xs text-ui-fg-subtle">
                        • Every {plan.interval_count} {plan.interval}
                        {plan.interval_count > 1 ? "s" : ""}
                      </Text>
                    )}

                    {plan.unit_amount != null && plan.currency && (
                      <Text className="text-xs text-ui-fg-subtle">
                        <span className="font-medium">Price:</span>{" "}
                        {(plan.unit_amount / 100).toFixed(2)}{" "}
                        {plan.currency.toUpperCase()}
                      </Text>
                    )}
                  </div>

                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => handleDelete(plan.id)}
                    disabled={
                      deletePlanMutation.isPending && deletingId === plan.id
                    }
                  >
                    Delete
                  </Button>
                </div>

                <Text className="text-xs text-ui-fg-subtle break-all">
                  <span className="font-medium">Stripe Price:</span>{" "}
                  {plan.stripe_price_id}
                </Text>
                <Text className="text-xs text-ui-fg-subtle break-all">
                  <span className="font-medium">Payment Link:</span>{" "}
                  {plan.payment_link_url}
                </Text>
              </div>
            ))}
          </div>
        )}

        <div className="h-px bg-ui-border-base my-4" />

        <Heading level="h3">Add subscription option</Heading>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Text className="text-xs font-medium">Name</Text>
            <Input
              placeholder="Monthly subscription"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Text className="text-xs font-medium">Interval</Text>
            <select
              className="border border-ui-border-base rounded px-2 py-1 text-sm bg-ui-bg-field shadow-[0_0_0_1px_rgba(0,0,0,0.02)]"
              value={interval ?? ""}
              onChange={(e) =>
                setInterval(
                  (e.target.value || null) as SubscriptionPlan["interval"]
                )
              }
            >
              <option value="">Select interval</option>
              <option value="day">day</option>
              <option value="week">week</option>
              <option value="month">month</option>
              <option value="year">year</option>
            </select>
          </div>

          <div className="space-y-1">
            <Text className="text-xs font-medium">Interval count</Text>
            <Input
              type="number"
              min={1}
              value={intervalCount}
              onChange={(e) =>
                setIntervalCount(Number(e.target.value) || 1)
              }
            />
          </div>

          <div className="space-y-1">
            <Text className="text-xs font-medium">Stripe Price ID</Text>
            <Input
              placeholder="price_123..."
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Text className="text-xs font-medium">Stripe Payment Link URL</Text>
          <Input
            placeholder="https://buy.stripe.com/..."
            value={paymentLinkUrl}
            onChange={(e) => setPaymentLinkUrl(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="e.g. 29.99"
            type="number"
            step="0.01"
            value={priceAmount}
            onChange={(e) => setPriceAmount(e.target.value)}
          />
          <Input
            placeholder="usd"
            value={priceCurrency}
            onChange={(e) => setPriceCurrency(e.target.value)}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button
            size="small"
            variant="primary"
            onClick={() => createPlanMutation.mutate()}
            disabled={
              !name ||
              !stripePriceId ||
              !paymentLinkUrl ||
              createPlanMutation.isPending
            }
          >
            {createPlanMutation.isPending ? "Saving…" : "Add subscription"}
          </Button>
        </div>

        {createPlanMutation.isError && (
          <Text className="text-xs text-ui-fg-error">
            Failed to create subscription plan.
          </Text>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductSubscriptionsWidget