import { useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Text, Badge } from "@medusajs/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

type JsonDate = { year: number; month: number; day: number }

type Money = { value: string; currency: string }

type Surcharge = { type: string; amount: Money }
type Tax = { type: string; amount: Money }

type FreightcomRate = {
  service_id: string
  valid_until?: JsonDate
  total?: Money
  base?: Money
  surcharges?: Surcharge[]
  taxes?: Tax[]
  transit_time_days?: number
  transit_time_not_available?: boolean
  carrier_name?: string
  service_name?: string
  paperless?: boolean
  // keep extra fields safely
  [k: string]: any
}

type RatesGetResponse = {
  request_id: string
  status?: { done: boolean; total: number; complete: number }
  sort?: string
  pagination?: {
    page: number
    page_size: number
    total_rates: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
  rates?: FreightcomRate[]
}

function getOrderFromWidgetData(data: any) {
  // Medusa admin detail widgets sometimes pass different shapes
  return data?.order ?? data?.resource ?? data ?? null
}

function formatJsonDate(d?: JsonDate) {
  if (!d) return "—"
  const mm = String(d.month).padStart(2, "0")
  const dd = String(d.day).padStart(2, "0")
  return `${d.year}-${mm}-${dd}`
}

function moneyLabel(m?: Money) {
  if (!m?.value) return "—"
  // Freightcom often returns cents-as-string; keep as-is (no assumptions)
  return `${m.value} ${m.currency || ""}`.trim()
}

function sumMoney(items: { amount: Money }[] | undefined) {
  if (!items || items.length === 0) return null
  const currency = items[0]?.amount?.currency
  const total = items.reduce((acc, it) => acc + (Number(it.amount?.value || 0) || 0), 0)
  return { value: String(total), currency: currency || "" }
}

export default function FreightcomRatesWidget({ data }: any) {
  const order = getOrderFromWidgetData(data)
  const orderId = order?.id

  const [requestId, setRequestId] = useState<string | null>(null)
  const [sort, setSort] = useState<"best" | "price" | "days">("best")
  const [page, setPage] = useState(1)
  const pageSize = 12

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  // 1) POST create request
  const createRequest = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Missing orderId")
      return sdk.client.fetch(`/admin/orders/${orderId}/freightcom/rates`, { method: "POST" })
    },
    onSuccess: (res: any) => {
      const id = res?.request_id
      if (!id) throw new Error("Backend did not return request_id")
      setRequestId(id)
      setPage(1)
      setSelectedServiceId(null)
    },
  })

  // 2) GET fetch paginated rates
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
    // Poll until done, but don’t spam forever
    refetchInterval: (q) => {
      const done = (q.state.data as any)?.status?.done
      const failures = q.state.fetchFailureCount ?? 0
      if (done) return false
      if (failures >= 8) return false
      return 1200
    },
  })

  const status = ratesQuery.data?.status
  const pagination = ratesQuery.data?.pagination
  const rates = ratesQuery.data?.rates || []

  const isWorking =
    createRequest.isPending || (ratesQuery.isFetching && !status?.done)

  // Reset to page 1 when sort changes
  useEffect(() => {
    setPage(1)
  }, [sort])

  const headerBadge = useMemo(() => {
    if (!requestId) return <Badge size="small" color="grey">Not started</Badge>
    if (status?.done) return <Badge size="small" color="green">Done</Badge>
    return <Badge size="small" color="orange">Processing</Badge>
  }, [requestId, status?.done])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between px-6 py-4 gap-4">
        <div className="min-w-0">
          <Heading level="h2">Freightcom Rates</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Get shipping options for this order (rates, surcharges, taxes, transit time).
          </Text>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {headerBadge}
            {requestId ? (
              <Text size="small" className="text-ui-fg-subtle break-all">
                Request: {requestId}
              </Text>
            ) : null}
            {status ? (
              <Text size="small" className="text-ui-fg-subtle">
                {status.complete}/{status.total} complete
              </Text>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* lightweight sort control using native select to avoid extra deps */}
          <select
            className="border border-ui-border-base rounded px-2 py-1 text-sm bg-ui-bg-field"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            disabled={!requestId && !orderId}
          >
            <option value="best">Best</option>
            <option value="price">Cheapest</option>
            <option value="days">Fastest</option>
          </select>

          <Button
            onClick={() => createRequest.mutate()}
            disabled={!orderId || createRequest.isPending}
          >
            {createRequest.isPending ? "Starting…" : "Get Rates"}
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 space-y-3">
        {(createRequest.isError || ratesQuery.isError) && (
          <Text size="small" className="text-ui-fg-error">
            {String(
              (createRequest.error as any)?.message ||
                (ratesQuery.error as any)?.message ||
                "Error"
            )}
          </Text>
        )}

        {!requestId && (
          <Text size="small" className="text-ui-fg-subtle">
            Click <span className="font-medium">Get Rates</span> to request quotes from Freightcom.
          </Text>
        )}

        {requestId && rates.length === 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            Waiting for rates… (auto-refreshing)
          </Text>
        )}

        {rates.length > 0 && (
          <div className="space-y-2">
            {rates.map((r) => {
              const surchargeTotal = sumMoney((r.surcharges || []).map((s) => ({ amount: s.amount })))
              const taxTotal = sumMoney((r.taxes || []).map((t) => ({ amount: t.amount })))

              const isSelected = selectedServiceId === r.service_id

              return (
                <div
                  key={r.service_id}
                  className={[
                    "rounded-md border p-3 transition",
                    isSelected ? "border-ui-fg-base" : "border-ui-border-base",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <Text className="font-medium">
                        {(r.carrier_name || "Carrier")} • {(r.service_name || r.service_id)}
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle break-all">
                        service_id: {r.service_id}
                      </Text>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.paperless ? (
                        <Badge size="small" color="green">Paperless</Badge>
                      ) : (
                        <Badge size="small" color="grey">Non-paperless</Badge>
                      )}
                      <Button
                        size="small"
                        variant={isSelected ? "primary" : "secondary"}
                        onClick={() => setSelectedServiceId(r.service_id)}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="rounded border border-ui-border-base p-2">
                      <Text size="small" className="text-ui-fg-subtle">Total</Text>
                      <Text className="font-medium">{moneyLabel(r.total)}</Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Base: {moneyLabel(r.base)}
                      </Text>
                    </div>

                    <div className="rounded border border-ui-border-base p-2">
                      <Text size="small" className="text-ui-fg-subtle">Time</Text>
                      <Text className="font-medium">
                        {r.transit_time_not_available ? "N/A" : `${r.transit_time_days} days`}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Valid until: {formatJsonDate(r.valid_until)}
                      </Text>
                    </div>

                    <div className="rounded border border-ui-border-base p-2">
                      <Text size="small" className="text-ui-fg-subtle">Extras</Text>
                      <Text size="small">
                        Surcharges: {moneyLabel(surchargeTotal || undefined)}
                      </Text>
                      <Text size="small">
                        Taxes: {moneyLabel(taxTotal || undefined)}
                      </Text>
                    </div>
                  </div>

                  {/* details list */}
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="rounded border border-ui-border-base p-2">
                      <Text size="xsmall" className="text-ui-fg-subtle">Surcharges</Text>
                      {(r.surcharges || []).length === 0 ? (
                        <Text size="small" className="text-ui-fg-subtle">None</Text>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {r.surcharges!.slice(0, 6).map((s, idx) => (
                            <Text key={`${s.type}-${idx}`} size="small">
                              {s.type}: {moneyLabel(s.amount)}
                            </Text>
                          ))}
                          {r.surcharges!.length > 6 && (
                            <Text size="small" className="text-ui-fg-subtle">
                              +{r.surcharges!.length - 6} more…
                            </Text>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded border border-ui-border-base p-2">
                      <Text size="xsmall" className="text-ui-fg-subtle">Taxes</Text>
                      {(r.taxes || []).length === 0 ? (
                        <Text size="small" className="text-ui-fg-subtle">None</Text>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {r.taxes!.slice(0, 6).map((t, idx) => (
                            <Text key={`${t.type}-${idx}`} size="small">
                              {t.type}: {moneyLabel(t.amount)}
                            </Text>
                          ))}
                          {r.taxes!.length > 6 && (
                            <Text size="small" className="text-ui-fg-subtle">
                              +{r.taxes!.length - 6} more…
                            </Text>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button
              size="small"
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.has_prev || isWorking}
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
              disabled={!pagination.has_next || isWorking}
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
