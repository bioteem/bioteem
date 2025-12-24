import { useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Text, Badge, Select } from "@medusajs/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

function getOrderFromWidgetData(data: any) {
  return data?.order ?? data?.resource ?? (data?.id ? data : null)
}

type RatesGetResponse = {
  request_id: string
  status: { done: boolean; total: number; complete: number }
  sort: string
  pagination: {
    page: number
    page_size: number
    total_rates: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
  rates: any[]
}

export default function FreightcomRatesWidget({ data }: any) {
  const order = getOrderFromWidgetData(data)
  const orderId = order?.id

  const [requestId, setRequestId] = useState<string | null>(null)
  const [sort, setSort] = useState<"best" | "price" | "days">("best")
  const [page, setPage] = useState(1)
  const pageSize = 20

  // POST: create rate request, returns request_id
  const createRates = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Missing orderId")
      return sdk.client.fetch(`/admin/orders/${orderId}/freightcom/rates`, {
        method: "POST",
      })
    },
    onSuccess: (res: any) => {
      const id = res?.request_id
      if (!id) throw new Error("No request_id returned from backend")
      setRequestId(id)
      setPage(1)
    },
  })

  // GET: fetch/poll rates by request_id
  const ratesQuery = useQuery({
    queryKey: ["freightcom-rates", orderId, requestId, sort, page, pageSize],
    enabled: Boolean(orderId && requestId),
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort,
      })
      return sdk.client.fetch<RatesGetResponse>(
        `/admin/orders/${orderId}/freightcom/rates/${requestId}?${qs.toString()}`
      )
    },
    // Poll until done
    refetchInterval: (q) => {
      const done = (q.state.data as any)?.status?.done
      return done ? false : 900
    },
  })

  const statusBadge = useMemo(() => {
    if (createRates.isPending) return <Badge size="small" color="orange">Creating…</Badge>
    if (!requestId) return <Badge size="small" color="grey">Not started</Badge>
    if (ratesQuery.isFetching && !ratesQuery.data?.status?.done)
      return <Badge size="small" color="orange">Fetching…</Badge>
    if (ratesQuery.data?.status?.done) return <Badge size="small" color="green">Done</Badge>
    return <Badge size="small" color="orange">Processing</Badge>
  }, [createRates.isPending, requestId, ratesQuery.isFetching, ratesQuery.data])

  const rates = ratesQuery.data?.rates ?? []
  const pagination = ratesQuery.data?.pagination

  // reset page if sort changes
  useEffect(() => {
    setPage(1)
  }, [sort])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between px-6 py-4 gap-4">
        <div className="min-w-0">
          <Heading level="h2">Freightcom Rates</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Create a rate request, then fetch all available services (FedEx / UPS / Purolator prioritized).
          </Text>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {statusBadge}
            {requestId ? (
              <Text size="small" className="text-ui-fg-subtle break-all">
                Request ID: {requestId}
              </Text>
            ) : null}
            {ratesQuery.data?.status ? (
              <Text size="small" className="text-ui-fg-subtle">
                {ratesQuery.data.status.complete}/{ratesQuery.data.status.total} complete
              </Text>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as any)}
            size="small"
          >
            <Select.Item value="best">Best (priority + cheapest)</Select.Item>
            <Select.Item value="price">Cheapest</Select.Item>
            <Select.Item value="days">Fastest</Select.Item>
          </Select>

          <Button
            onClick={() => createRates.mutate()}
            disabled={!orderId || createRates.isPending}
          >
            {createRates.isPending ? "Starting…" : "Get Rates"}
          </Button>
        </div>
      </div>

      <div className="px-6 py-4">
        {(createRates.isError || ratesQuery.isError) && (
          <Text size="small" className="text-ui-fg-error">
            {String((createRates.error as any)?.message || (ratesQuery.error as any)?.message || "Error")}
          </Text>
        )}

        {!requestId && (
          <Text size="small" className="text-ui-fg-subtle">
            Click <span className="font-medium">Get Rates</span> to create a Freightcom rate request.
          </Text>
        )}

        {requestId && rates.length === 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            Waiting for rates… (this will auto-refresh)
          </Text>
        )}

        {rates.length > 0 && (
          <div className="space-y-2">
            {rates.map((r, idx) => {
              const total = r?.total?.value
              const currency = r?.total?.currency
              const days = r?.transit_time_not_available ? "N/A" : r?.transit_time_days
              const carrier = r?.carrier_name ?? "Carrier"
              const service = r?.service_name ?? r?.service_id ?? "Service"

              return (
                <div
                  key={`${r.service_id ?? idx}`}
                  className="rounded-md border px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Text className="font-medium">
                      {carrier} • {service}
                    </Text>
                    <Text className="text-sm">
                      {total} {currency}{" "}
                      <span className="text-ui-fg-subtle">
                        • {days} days
                      </span>
                    </Text>
                  </div>

                  <Text className="text-xs text-ui-fg-subtle break-all">
                    <span className="font-medium">service_id:</span> {r.service_id}
                  </Text>

                  {(r.surcharges?.length || 0) > 0 && (
                    <Text className="text-xs text-ui-fg-subtle">
                      Surcharges: {r.surcharges.length}
                    </Text>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {pagination && pagination.total_pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <Button
              size="small"
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.has_prev || ratesQuery.isFetching}
            >
              Prev
            </Button>

            <Text size="small" className="text-ui-fg-subtle">
              Page {pagination.page} / {pagination.total_pages} • {pagination.total_rates} rates
            </Text>

            <Button
              size="small"
              variant="secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.has_next || ratesQuery.isFetching}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})
