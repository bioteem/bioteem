import { useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Text, Badge, FocusModal } from "@medusajs/ui"
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

type RatesPostResponse =
  | { request_id: string; status: "processing" }
  | {
      request_id: string
      status: "ready"
      status_meta?: { done: boolean; total: number; complete: number }
      pagination?: { page: number; page_size: number; total: number; total_pages: number }
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
  const total = items.reduce((acc, it) => acc + (Number(it.amount?.value || 0) || 0), 0)
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

    const ad = Number.isFinite(Number(a.transit_time_days)) ? Number(a.transit_time_days) : Number.POSITIVE_INFINITY
    const bd = Number.isFinite(Number(b.transit_time_days)) ? Number(b.transit_time_days) : Number.POSITIVE_INFINITY
    return ad - bd
  })
}

function safeStr(v: any) {
  return typeof v === "string" && v.trim().length ? v.trim() : "—"
}

function inferPackagesFromOrder(order: any) {
  const DEFAULT_WEIGHT_G = Number(order?.metadata?.default_weight_g ?? 500)
  const items = Array.isArray(order?.items) ? order.items : []
  const totalQty = items.reduce((acc: number, it: any) => acc + (Number(it?.quantity) || 0), 0)
  const estWeightG = items.reduce((acc: number, it: any) => {
    const qty = Math.max(1, Number(it?.quantity || 1))
    const w = Number(it?.variant?.weight)
    const wUse = Number.isFinite(w) ? w : DEFAULT_WEIGHT_G
    return acc + wUse * qty
  }, 0)

  return { totalQty, estWeightG }
}

export default function FreightcomRatesWidget({ data }: any) {
  const order = getOrderFromWidgetData(data)
  const orderId = order?.id

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  const [lastResult, setLastResult] = useState<RatesPostResponse | null>(null)
  const requestId = lastResult?.request_id ?? null

  // We will POLL the SAME POST endpoint until it returns "ready".
  // IMPORTANT: This requires your backend POST to be idempotent for a short window.
  // Right now your backend ALWAYS creates a new request_id every call -> that will NEVER settle.
  //
  // So we do:
  // - Call POST once (creates request_id + might return ready)
  // - If processing, poll a NEW GET endpoint OR a POST endpoint that accepts request_id.
  //
  // Because your backend route currently ALWAYS creates a NEW request id, your modal can open with no rates.
  //
  // FIX: front-end will:
  // 1) call POST once to create request_id
  // 2) then poll GET /admin/orders/:id/freightcom/rates/:request_id (you said you have this earlier)
  //
  // That keeps the SAME requestId and will actually return rates.

  const startRates = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Missing orderId")
      const res = await sdk.client.fetch<RatesPostResponse>(`/admin/orders/${orderId}/freightcom/rates`, {
        method: "POST",
      })
      return res
    },
    onSuccess: (res) => {
      setLastResult(res)
      setSelectedServiceId(null)
      // DO NOT open modal here unless we already have rates in this response
      if (res.status === "ready" && Array.isArray(res.rates) && res.rates.length) {
        setSelectedServiceId(res.rates[0].service_id)
        setIsModalOpen(true)
      }
    },
  })

  // Poll the GET endpoint using the requestId we got from POST
  const pollQuery = useQuery({
    queryKey: ["freightcom-rates", orderId, requestId],
    enabled: Boolean(orderId && requestId) && !isModalOpen,
    queryFn: async () => {
      if (!orderId || !requestId) throw new Error("Missing orderId/requestId")
      // NOTE: your current POST route returns pagination in a different shape than your earlier widget expects.
      // Here we just fetch ALL rates by requestId. If your GET supports pagination, keep it — but most important: rates[].
      return sdk.client.fetch<any>(`/admin/orders/${orderId}/freightcom/rates/${requestId}`)
    },
    refetchInterval: (q) => {
      const done = Boolean((q.state.data as any)?.status?.done || (q.state.data as any)?.status_meta?.done)
      const failures = q.state.fetchFailureCount ?? 0
      if (done) return false
      if (failures >= 10) return false
      return 1200
    },
  })

  // Normalize “status done” + rates list from either backend shape
  const done =
    Boolean((pollQuery.data as any)?.status?.done) ||
    Boolean((pollQuery.data as any)?.status_meta?.done) ||
    Boolean((lastResult as any)?.status_meta?.done)

  const progressTotal =
    (pollQuery.data as any)?.status?.total ??
    (pollQuery.data as any)?.status_meta?.total ??
    (lastResult as any)?.status_meta?.total

  const progressComplete =
    (pollQuery.data as any)?.status?.complete ??
    (pollQuery.data as any)?.status_meta?.complete ??
    (lastResult as any)?.status_meta?.complete

  const rawRates: FreightcomRate[] =
    ((pollQuery.data as any)?.rates as FreightcomRate[]) ??
    ((lastResult as any)?.rates as FreightcomRate[]) ??
    []

  const rates = useMemo(() => sortRatesMajorFirst(rawRates || []), [rawRates])

  // Open modal ONLY when ready + we have rates
  useEffect(() => {
    if (isModalOpen) return
    if (!requestId) return
    if (!done) return
    if (!rates.length) return

    setSelectedServiceId((prev) => prev ?? rates[0]?.service_id ?? null)
    setIsModalOpen(true)
  }, [isModalOpen, requestId, done, rates.length])

  const headerBadge = useMemo(() => {
    if (!requestId) return <Badge size="small" color="grey">Not started</Badge>
    if (done) return <Badge size="small" color="green">Ready</Badge>
    return <Badge size="small" color="orange">Processing</Badge>
  }, [requestId, done])

  const isWorking = startRates.isPending || (pollQuery.isFetching && !done)

  // ----- Show “payload preview” beneath button -----
  const ship = order?.shipping_address
  const pkg = inferPackagesFromOrder(order)

  const preview = useMemo(() => {
    return {
      origin: {
        name: "Warehouse",
        address: {
          address_line_1: "Centennial Drive",
          unit_number: "93",
          city: "Windsor",
          region: "NS",
          country: "CA",
          postal_code: "B0N2T0",
        },
      },
      destination: {
        name: `${safeStr(ship?.first_name)} ${safeStr(ship?.last_name)}`.trim(),
        address: {
          address_line_1: safeStr(ship?.address_1),
          address_line_2: safeStr(ship?.address_2),
          unit_number: safeStr(ship?.company),
          city: safeStr(ship?.city),
          region: safeStr(ship?.province),
          country: safeStr((ship?.country_code || "").toUpperCase()),
          postal_code: safeStr(ship?.postal_code),
        },
        email: safeStr(order?.email),
      },
      items: (order?.items || []).slice(0, 8).map((it: any) => ({
        title: safeStr(it?.title),
        qty: Number(it?.quantity || 0),
        weight_g: Number.isFinite(Number(it?.variant?.weight)) ? Number(it?.variant?.weight) : 500,
        dims_cm: {
          l: Number.isFinite(Number(it?.variant?.length)) ? Number(it?.variant?.length) : 20,
          w: Number.isFinite(Number(it?.variant?.width)) ? Number(it?.variant?.width) : 15,
          h: Number.isFinite(Number(it?.variant?.height)) ? Number(it?.variant?.height) : 10,
        },
      })),
      summary: {
        total_items: pkg.totalQty,
        est_total_weight_g: pkg.estWeightG,
      },
    }
  }, [order, ship])

  const selectedRate = useMemo(
    () => rates.find((r) => r.service_id === selectedServiceId) || null,
    [rates, selectedServiceId]
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between px-6 py-4 gap-4">
        <div className="min-w-0">
          <Heading level="h2">Freightcom Rates</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Request Freightcom rates and then choose a carrier/service.
          </Text>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {headerBadge}
            {requestId ? (
              <Text size="small" className="text-ui-fg-subtle break-all">
                Request: {requestId}
              </Text>
            ) : null}
            {typeof progressComplete === "number" && typeof progressTotal === "number" ? (
              <Text size="small" className="text-ui-fg-subtle">
                {progressComplete}/{progressTotal} complete
              </Text>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => startRates.mutate()} disabled={!orderId || isWorking}>
            {isWorking ? "Processing…" : "Get Rates"}
          </Button>
        </div>
      </div>

      {/* Payload preview (what you send) */}
      <div className="px-6 py-4 space-y-3">
        {(startRates.isError || pollQuery.isError) && (
          <Text size="small" className="text-ui-fg-error">
            {String((startRates.error as any)?.message || (pollQuery.error as any)?.message || "Error")}
          </Text>
        )}

        <div className="rounded-md border border-ui-border-base p-3">
          <Text size="small" className="text-ui-fg-subtle">
            Preview of the details sent to Freightcom:
          </Text>

          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border border-ui-border-base p-2">
              <Text size="xsmall" className="text-ui-fg-subtle">Origin</Text>
              <Text size="small" className="font-medium">{preview.origin.name}</Text>
              <Text size="small">{preview.origin.address.unit_number} {preview.origin.address.address_line_1}</Text>
              <Text size="small">
                {preview.origin.address.city}, {preview.origin.address.region} {preview.origin.address.postal_code}
              </Text>
              <Text size="small">{preview.origin.address.country}</Text>
            </div>

            <div className="rounded border border-ui-border-base p-2">
              <Text size="xsmall" className="text-ui-fg-subtle">Destination</Text>
              <Text size="small" className="font-medium">{preview.destination.name || "Customer"}</Text>
              <Text size="small">{preview.destination.address.address_line_1}</Text>
              {preview.destination.address.address_line_2 !== "—" ? (
                <Text size="small">{preview.destination.address.address_line_2}</Text>
              ) : null}
              <Text size="small">
                {preview.destination.address.city}, {preview.destination.address.region} {preview.destination.address.postal_code}
              </Text>
              <Text size="small">{preview.destination.address.country}</Text>
              <Text size="small" className="text-ui-fg-subtle">Email: {preview.destination.email}</Text>
            </div>
          </div>

          <div className="mt-3 rounded border border-ui-border-base p-2">
            <Text size="xsmall" className="text-ui-fg-subtle">Items (first {preview.items.length})</Text>
            <div className="mt-1 space-y-1">
              {preview.items.map((it, idx) => (
                <Text key={`${it.title}-${idx}`} size="small" className="text-ui-fg-subtle">
                  • {it.title} ×{it.qty} — weight {it.weight_g}g — {it.dims_cm.l}×{it.dims_cm.w}×{it.dims_cm.h} cm
                </Text>
              ))}
            </div>
            <div className="mt-2 flex gap-4 flex-wrap">
              <Text size="small" className="text-ui-fg-subtle">
                Total qty: <span className="font-medium text-ui-fg-base">{preview.summary.total_items}</span>
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                Est weight: <span className="font-medium text-ui-fg-base">{Math.round(preview.summary.est_total_weight_g)}g</span>
              </Text>
            </div>
          </div>
        </div>

        {/* status line */}
        {requestId && !done && (
          <Text size="small" className="text-ui-fg-subtle">
            Processing… rates will open automatically when ready.
          </Text>
        )}
        {requestId && done && rates.length === 0 && (
          <Text size="small" className="text-ui-fg-subtle">
            Freightcom finished but returned 0 rates.
          </Text>
        )}
      </div>

      {/* Modal (ONLY shows when ready + rates exist) */}
      <FocusModal open={isModalOpen} onOpenChange={(o) => setIsModalOpen(o)}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex items-center justify-between w-full">
              <Heading level="h2">Select a Rate</Heading>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="small" onClick={() => setIsModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="p-6">
            {!done ? (
              <Text size="small" className="text-ui-fg-subtle">
                Processing… (this modal should not normally open until ready)
              </Text>
            ) : rates.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">
                No rates returned.
              </Text>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {rates.map((r) => {
                  const isSelected = selectedServiceId === r.service_id
                  const surchargeTotal = sumMoney((r.surcharges || []).map((s) => ({ amount: s.amount })))
                  const taxTotal = sumMoney((r.taxes || []).map((t) => ({ amount: t.amount })))

                  return (
                    <button
                      key={r.service_id}
                      type="button"
                      onClick={() => setSelectedServiceId(r.service_id)}
                      className={[
                        "text-left rounded-md border p-3 transition w-full",
                        isSelected ? "border-ui-fg-base bg-ui-bg-base" : "border-ui-border-base hover:border-ui-fg-subtle",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Text className="font-medium">
                            {(r.carrier_name || "Carrier")} • {(r.service_name || r.service_id)}
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
                          {isSelected ? <Badge size="small" color="blue">Selected</Badge> : null}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div className="rounded border border-ui-border-base p-2">
                          <Text size="xsmall" className="text-ui-fg-subtle">Total</Text>
                          <Text className="font-medium">{moneyLabel(r.total)}</Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">Base: {moneyLabel(r.base)}</Text>
                        </div>

                        <div className="rounded border border-ui-border-base p-2">
                          <Text size="xsmall" className="text-ui-fg-subtle">Time</Text>
                          <Text className="font-medium">
                            {r.transit_time_not_available ? "N/A" : `${r.transit_time_days} days`}
                          </Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            Valid: {formatJsonDate(r.valid_until)}
                          </Text>
                        </div>

                        <div className="rounded border border-ui-border-base p-2">
                          <Text size="xsmall" className="text-ui-fg-subtle">Extras</Text>
                          <Text size="small">Surch.: {moneyLabel(surchargeTotal || undefined)}</Text>
                          <Text size="small">Tax: {moneyLabel(taxTotal || undefined)}</Text>
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
                  {(selectedRate.carrier_name || "Carrier")} • {(selectedRate.service_name || selectedRate.service_id)}
                </Text>
                <Text size="small" className="text-ui-fg-subtle">
                  Total: {moneyLabel(selectedRate.total)}
                </Text>
              </div>
            )}

            <Text size="xsmall" className="text-ui-fg-subtle mt-4">
              Next step (purchase label / create shipment) will be wired after selection.
            </Text>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})
