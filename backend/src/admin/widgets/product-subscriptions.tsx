// src/admin/widgets/product-subscriptions.tsx
import { useState } from "react"
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
  product_id: string
  name: string
  interval: "day" | "week" | "month" | "year" | null
  interval_count: number | null
  stripe_price_id: string
  payment_link_url: string
  active: boolean
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

  const { data: plansData, isLoading, isError } = useQuery({
    queryKey: ["subscription-plans", productId],
    queryFn: async () => {
      const res = await sdk.client.fetch<PlansResponse>(
        `/admin/products/${productId}/subscription-plans`
      )
      return res
    },
  })

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
    },
  })

  const plans = plansData?.subscription_plans ?? []

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
                className="flex flex-col gap-y-1 rounded-md border px-3 py-2"
              >
                <div className="flex items-center justify-between gap-x-2">
                  <div className="flex items-center gap-x-2">
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
                  </div>
                  {plan.interval && plan.interval_count && (
                    <Text className="text-xs text-ui-fg-subtle">
                      Every {plan.interval_count} {plan.interval}
                      {plan.interval_count > 1 ? "s" : ""}
                    </Text>
                  )}
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