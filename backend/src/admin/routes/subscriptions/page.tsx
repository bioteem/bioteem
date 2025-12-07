// src/admin/routes/subscriptions/page.tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

type Subscription = {
  id: string
  customer_id: string
  plan_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  stripe_latest_invoice_id?: string | null
  status:
    | "incomplete"
    | "active"
    | "past_due"
    | "canceled"
    | "incomplete_expired"
    | "trialing"
    | "unpaid"
  current_period_start?: string | null
  current_period_end?: string | null
  billing_email?: string | null
  shipping_name?: string | null
  shipping_city?: string | null
  shipping_country?: string | null
  last_order_id?: string | null
  last_order_created_at?: string | null
}

type SubscriptionsResponse = {
  subscriptions: Subscription[]
}

const SubscriptionsPage = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const res = await sdk.client.fetch<SubscriptionsResponse>(
        "/admin/subscriptions"
      )
      return res
    },
  })

  const subs = data?.subscriptions ?? []

  return (
    <Container className="p-6 space-y-4">
      <Heading level="h1">Subscriptions</Heading>
      <Text className="text-ui-fg-subtle">
        Overview of all active and past Stripe subscriptions synced into
        Medusa.
      </Text>

      {isLoading && <Text>Loading subscriptions…</Text>}
      {isError && (
        <Text className="text-ui-fg-error">Failed to load subscriptions.</Text>
      )}

      {!isLoading && subs.length === 0 && (
        <Text className="text-ui-fg-subtle">
          No subscriptions found yet. Once customers subscribe via Stripe,
          they’ll appear here.
        </Text>
      )}

      {subs.length > 0 && (
        <div className="space-y-2">
          {subs.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-md border px-3 py-2 text-xs"
            >
              <div className="space-y-1">
                <Text className="font-medium">Customer</Text>
                <Text>{s.billing_email ?? s.customer_id}</Text>
                {s.shipping_name && (
                  <Text className="text-ui-fg-subtle">
                    {s.shipping_name}
                    {s.shipping_city ? ` • ${s.shipping_city}` : ""}
                    {s.shipping_country ? ` • ${s.shipping_country}` : ""}
                  </Text>
                )}
              </div>

              <div className="space-y-1">
                <Text className="font-medium">Stripe</Text>
                <Text className="break-all">
                  Sub: {s.stripe_subscription_id}
                </Text>
                {s.stripe_latest_invoice_id && (
                  <Text className="break-all text-ui-fg-subtle">
                    Inv: {s.stripe_latest_invoice_id}
                  </Text>
                )}
              </div>

              <div className="space-y-1">
                <Text className="font-medium">Status</Text>
                <Badge size="small" className="w-fit capitalize">
                  {s.status.replace("_", " ")}
                </Badge>
                {s.current_period_end && (
                  <Text className="text-ui-fg-subtle">
                    Renews until{" "}
                    {new Date(s.current_period_end).toLocaleDateString()}
                  </Text>
                )}
              </div>

              <div className="space-y-1">
                <Text className="font-medium">Last order</Text>
                {s.last_order_id ? (
                  <>
                    <Text className="break-all">{s.last_order_id}</Text>
                    {s.last_order_created_at && (
                      <Text className="text-ui-fg-subtle">
                        {new Date(
                          s.last_order_created_at
                        ).toLocaleString()}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text className="text-ui-fg-subtle">
                    No orders generated yet
                  </Text>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Container>
  )
}

// route config so it appears in sidebar
export const config = defineRouteConfig({
  label: "Subscriptions",
  icon: "repeat", // any lucide icon supported by admin, e.g. "repeat"
})

export default SubscriptionsPage