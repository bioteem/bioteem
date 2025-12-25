import { useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Text,
  Badge,
  FocusModal,
} from "@medusajs/ui"
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
  [k: string]: any
}

type RatesGetResponse = {
  request_id: string
  status?: { done: boolean; total: number; complete: number }
  pagination?: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
  rates?: FreightcomRate[]
}

function getOrderFromWidgetData(data: any) {
  return data?.order ?? data?.resource ?? data ?? null
}

function formatJsonDate(d?: JsonDate) {
  if (!d) return "—"
  const mm = String(d.month).padStart(2, "0")
  const dd = String(d.day).padStart(2, "0")
  return `${d.year}-${mm}-${dd}`
}

// Freightcom values look like cents-as-string ("2116" => $21.16)
function moneyLabel(m?: Money) {
  if (!m?.value) return "—"
  const cents = Number(m.value)
  if (Number.isFinite(cents)) {
    const dollars = (Math.round(cents) / 100).toFixed(2)
    return `${dollars} ${m.currency || ""}`.trim()
  }
  return `${m.value} ${m.currency || ""}`.trim()
}

function sumMoney(items: { amount: Money }[] | undefined) {
  if (!items || items.length === 0) return null
  const currency = items[0]?.amount?.currency
  const total = items.reduce(
    (acc, it) => acc + (Number(it.amount?.value || 0) || 0),
    0
  )
  return { value: String(total), currency: currency || "" }
}

function carrierPriorityScore(name: string) {
  const s = (name || "").toLowerCase()
  if (s.includes("purolator")) return 0
  if (s.includes("fedex") || s.includes("fed ex")) return 1
  if (s.includes("ups")) return 2
  if (s.includes("dhl")) return 3
  if (s.includes("canada post") || s.includes("canadapost")) return 4
  if (s.includes("canpar")) return 10
  return 50
}

function sortRatesMajorFirst(rates: FreightcomRate[]) {
  return [...rates].sort((a, b) => {
    const ap = carrierPriorityScore(a.carrier_name || "")
    const bp = carrierPriorityScore(b.carrier_name || "")
    if (ap !== bp) return ap - bp

    const at = Number(a.total?.value ?? Number.POSITIVE_INFINITY)
    const bt = Number(b.total?.value ?? Number.POSITIVE_INFINITY)
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt
    if (Number.isFinite(at) && !Number.isFinite(bt)) return -1
    if (!Number.isFinite(at) && Number.isFinite(bt)) return 1

    const aPenalty = a.transit_time_not_available ? 1 : 0
    const bPenalty = b.transit_time_not_available ? 1 : 0
    if (aPenalty !== bPenalty) return aPenalty - bPenalty

    const ad = Number.isFinite(Number(a.transit_time_days))
      ? Number(a.transit_time_days)
      : Number.POSITIVE_INFINITY
    const bd = Number.isFinite(Number(b.transit_time_days))
      ? Number(b.transit_time_days)
      : Number.POSITIVE_INFINITY
    return ad - bd
  })
}

export default function FreightcomRatesWidget({ data }: any) {
  const order = getOrderFromWidgetData(data)
  const orderId = order?.id

  const [requestId, setRequestId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 12

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  // 1) POST create request (your combined route returns 202 if processing, 200 if ready)
  const createOrFetch = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Missing orderId")
      return sdk.client.fetch(`/admin/orders/${orderId}/freightcom/rates`, {
        method: "POST",
      })
    },
    onSuccess: (res: any) => {
      // route always returns request_id
      if (!res?.request_id) throw new Error("Backend did not return request_id")
      setRequestId(res.request_id)
      setPage(1)

      // If backend already returned ready + rates, open modal immediately
      if (res?.status === "ready" && Array.isArray(res?.rates) && res.rates.length) {
        // pick the first option by default
        setSelectedServiceId(res.rates[0]?.service_id ?? null)
        setIsModalOpen(true)
      }
    },
  })

  // 2) If request_id exists, keep calling the SAME POST route until ready
  //    (Because your final route.ts both creates and can return ready rates)
  const pollQuery = useQuery({
    queryKey: ["freightcom-rates-poll", orderId, requestId, page, pageSize],
    enabled: Boolean(orderId && requestId) && !isModalOpen,
    queryFn: async () => {
      // You can also switch this to GET if you have one.
      // This assumes your POST route can be called again (idempotent on Freightcom side is fine because it creates new request_id).
      // If you want to reuse the SAME request_id, you should create a GET endpoint /rates/:requestId.
      //
      // So: for best UX, we DO NOT create new request here.
      // We'll use GET if you have it; if not, you should add it.
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      })

      // Preferred: GET existing requestId (your earlier widget route)
      return sdk.client.fetch<RatesGetResponse>(
        `/admin/orders/${orderId}/freightcom/rates/${requestId}?${qs.toString()}`
      )
    },
    refetchInterval: (q) => {
      const done = (q.state.data as any)?.status?.done
      const failures = q.state.fetchFailureCount ?? 0
      if (done) return false
      if (failures >= 8) return false
      return 1200
    },
  })

  const status = pollQuery.data?.status
  const pagination = pollQuery.data?.pagination
  const rawRates = pollQuery.data?.rates || []

  const rates = useMemo(() => sortRatesMajorFirst(rawRates), [rawRates])

  const isWorking =
    createOrFetch.isPending || (pollQuery.isFetching && !status?.done)

  // When rates become ready, auto-open modal (once)
  useEffect(() => {
    if (!requestId) return
    if (!status?.done) return
    if (isModalOpen) return
    if (!rates.length) return

    setSelectedServiceId((prev) => prev ?? rates[0]?.service_id ?? null)
    setIsModalOpen(true)
  }, [requestId, status?.done, rates.length, isModalOpen])

  const headerBadge = useMemo(() => {
    if (!requestId) return <Badge size="small" color="grey">Not started</Badge>
    if (status?.done) return <Badge size="small" color="green">Done</Badge>
    return <Badge size="small" color="orange">Processing</Badge>
  }, [requestId, status?.done])

  const selectedRate = useMemo(() => {
    if (!selectedServiceId) return null
    return rates.find((r) => r.service_id === selectedServiceId) || null
  }, [rates, selectedServiceId])

  // 3) Confirm selection -> next step (create shipment/label)
  // You said: "for the next processes to create a shipping for that order"
  // Replace the endpoint below with YOUR real endpoint that purchases/creates the shipment.
  const createShipment = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Missing orderId")
      if (!requestId) throw new Error("Missing requestId")
      if (!selectedRate) throw new Error("Select a rate first")

      return sdk.client.fetch(`/admin/orders/${orderId}/freightcom/shipments`, {
        method: "POST",
        body: {
          request_id: requestId,
          service_id: selectedRate.service_id,
          // include any extra you want the backend to store
          carrier_name: selectedRate.carrier_name,
          service_name: selectedRate.service_name,
          quoted_total: selectedRate.total,
        },
      })
    },
    onSuccess: () => {
      setIsModalOpen(false)
    },
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between px-6 py-4 gap-4">
        <div className="min-w-0">
          <Heading level="h2">Freightcom Rates</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Get shipping options for this order and choose a provider.
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
          <Button
            onClick={() => createOrFetch.mutate()}
            disabled={!orderId || createOrFetch.isPending}
          >
            {createOrFetch.isPending ? "Starting…" : "Get Rates"}
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsModalOpen(true)}
            disabled={!requestId || !status?.done || rates.length === 0}
          >
            Choose Rate
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 space-y-3">
        {(createOrFetch.isError || pollQuery.isError || createShipment.isError) && (
          <Text size="small" className="text-ui-fg-error">
            {String(
              (createOrFetch.error as any)?.message ||
                (pollQuery.error as any)?.message ||
                (createShipment.error as any)?.message ||
                "Error"
            )}
          </Text>
        )}

        {!requestId && (
          <Text size="small" className="text-ui-fg-subtle">
            Click <span className="font-medium">Get Rates</span> to request quotes from Freightcom.
          </Text>
        )}

        {requestId && !status?.done && (
          <Text size="small" className="text-ui-fg-subtle">
            Waiting for rates… (auto-refreshing)
          </Text>
        )}

        {status?.done && rates.length > 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            Rates ready. Click <span className="font-medium">Choose Rate</span>.
          </Text>
        )}

        {/* Pagination (still useful for status page / debugging) */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button
              size="small"
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isWorking}
            >
              Prev
            </Button>

            <Text size="small" className="text-ui-fg-subtle">
              Page {pagination.page} / {pagination.total_pages} • {pagination.total} rates
            </Text>

            <Button
              size="small"
              variant="secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.total_pages || isWorking}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Modal for selecting a provider/rate */}
      <FocusModal open={isModalOpen} onOpenChange={(o) => setIsModalOpen(o)}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex items-center justify-between w-full">
              <Heading level="h2">Select Shipping Rate</Heading>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setIsModalOpen(false)}
                >
                  Close
                </Button>
                <Button
                  size="small"
                  onClick={() => createShipment.mutate()}
                  disabled={!selectedRate || createShipment.isPending}
                >
                  {createShipment.isPending ? "Creating…" : "Create Shipment"}
                </Button>
              </div>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="p-6">
            {!status?.done ? (
              <Text size="small" className="text-ui-fg-subtle">
                Rates are still processing. Close this modal and wait a moment.
              </Text>
            ) : rates.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">
                No rates returned.
              </Text>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {rates.map((r) => {
                  const isSelected = selectedServiceId === r.service_id
                  const surchargeTotal = sumMoney(
                    (r.surcharges || []).map((s) => ({ amount: s.amount }))
                  )
                  const taxTotal = sumMoney(
                    (r.taxes || []).map((t) => ({ amount: t.amount }))
                  )

                  return (
                    <button
                      key={r.service_id}
                      type="button"
                      onClick={() => setSelectedServiceId(r.service_id)}
                      className={[
                        "text-left rounded-md border p-3 transition w-full",
                        isSelected
                          ? "border-ui-fg-base bg-ui-bg-base"
                          : "border-ui-border-base hover:border-ui-fg-subtle",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Text className="font-medium">
                            {(r.carrier_name || "Carrier")} •{" "}
                            {(r.service_name || r.service_id)}
                          </Text>
                          <Text size="small" className="text-ui-fg-subtle break-all">
                            {r.service_id}
                          </Text>
                        </div>

                        <div className="flex items-center gap-2">
                          {r.paperless ? (
                            <Badge size="small" color="green">Paperless</Badge>
                          ) : (
                            <Badge size="small" color="grey">Non-paperless</Badge>
                          )}
                          {isSelected ? (
                            <Badge size="small" color="blue">Selected</Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div className="rounded border border-ui-border-base p-2">
                          <Text size="xsmall" className="text-ui-fg-subtle">Total</Text>
                          <Text className="font-medium">{moneyLabel(r.total)}</Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            Base: {moneyLabel(r.base)}
                          </Text>
                        </div>

                        <div className="rounded border border-ui-border-base p-2">
                          <Text size="xsmall" className="text-ui-fg-subtle">Time</Text>
                          <Text className="font-medium">
                            {r.transit_time_not_available
                              ? "N/A"
                              : `${r.transit_time_days} days`}
                          </Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            Valid: {formatJsonDate(r.valid_until)}
                          </Text>
                        </div>

                        <div className="rounded border border-ui-border-base p-2">
                          <Text size="xsmall" className="text-ui-fg-subtle">Extras</Text>
                          <Text size="small">
                            Surch.: {moneyLabel(surchargeTotal || undefined)}
                          </Text>
                          <Text size="small">
                            Tax: {moneyLabel(taxTotal || undefined)}
                          </Text>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {selectedRate && (
              <div className="mt-4 rounded-md border border-ui-border-base p-3">
                <Text size="small" className="text-ui-fg-subtle">Selected</Text>
                <Text className="font-medium">
                  {(selectedRate.carrier_name || "Carrier")} •{" "}
                  {(selectedRate.service_name || selectedRate.service_id)}
                </Text>
                <Text size="small" className="text-ui-fg-subtle">
                  Total: {moneyLabel(selectedRate.total)}
                </Text>
              </div>
            )}
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})
