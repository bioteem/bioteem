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
import { useMutation } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

type Money = { value: string; currency: string }
type JsonDate = { year: number; month: number; day: number }

type FreightcomRate = {
  service_id: string
  carrier_name?: string
  service_name?: string
  total?: Money
  base?: Money
  transit_time_days?: number
  transit_time_not_available?: boolean
  valid_until?: JsonDate
  paperless?: boolean
  [k: string]: any
}

type Preview = {
  origin: any
  destination: any
  expected_ship_date?: JsonDate
  package_defaults_used?: any
  package_debug?: any
  packages_preview?: any[]
}

type ReadyResp = {
  request_id: string
  status: "ready"
  status_meta?: any
  preview?: Preview
  rates?: FreightcomRate[]
  rates_total?: number
  offset?: number
  limit?: number
  next_offset?: number
}

type ProcessingResp = {
  request_id: string
  status: "processing"
  status_meta?: any
  preview?: Preview
}

type PostResp = ReadyResp | ProcessingResp

type PaymentMethodsResp = {
  methods: { id: string; label: string }[]
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

function moneyLabel(m?: Money) {
  if (!m?.value) return "—"
  const cents = Number(m.value)
  if (Number.isFinite(cents)) return `${(Math.round(cents) / 100).toFixed(2)} ${m.currency || ""}`.trim()
  return `${m.value} ${m.currency || ""}`.trim()
}

function toJsonDate(iso: string): JsonDate {
  const [y, m, d] = iso.split("-").map((x) => Number(x))
  return { year: y, month: m, day: d }
}

function defaultShipDateISO() {
  const d = new Date()
  if (d.getHours() >= 16) d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export default function FreightcomRatesWidget({ data }: any) {
  const order = getOrderFromWidgetData(data)
  const orderId = order?.id

  // Package defaults
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric")
  const [defWeightG, setDefWeightG] = useState(500)
  const [defLCm, setDefLCm] = useState(20)
  const [defWCm, setDefWCm] = useState(15)
  const [defHCm, setDefHCm] = useState(10)

  // Ship date selection
  const [shipDateISO, setShipDateISO] = useState<string>(() => defaultShipDateISO())

  // Modal / stepper
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  // Selection
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  // Page caching
  const [pages, setPages] = useState<FreightcomRate[][]>([])
  const [cursorOffsets, setCursorOffsets] = useState<number[]>([0])
  const [pageIndex, setPageIndex] = useState(0)

  // Response meta
  const [meta, setMeta] = useState<{
    request_id: string | null
    status: "idle" | "processing" | "ready"
    status_meta?: any
    preview?: Preview
    rates_total?: number
    next_offset?: number
  }>({ request_id: null, status: "idle" })

  const requestId = meta.request_id
  const done = meta.status === "ready"
  const currentRates = pages[pageIndex] || []

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; label: string }[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)

  const ship = order?.shipping_address
  const destinationPreview = useMemo(() => {
    return {
      name: `${ship?.first_name || ""} ${ship?.last_name || ""}`.trim() || "Customer",
      address: {
        address_line_1: ship?.address_1 || "—",
        address_line_2: ship?.address_2 || "",
        unit_number: ship?.company || "",
        city: ship?.city || "—",
        region: ship?.province || "—",
        country: (ship?.country_code || "—").toUpperCase(),
        postal_code: ship?.postal_code || "—",
      },
      email: order?.email || "—",
    }
  }, [ship, order?.email])

  const headerBadge = useMemo(() => {
    if (!requestId) return <Badge size="small" color="grey">Not started</Badge>
    if (done) return <Badge size="small" color="green">Ready</Badge>
    return <Badge size="small" color="orange">Processing</Badge>
  }, [requestId, done])

  const selectedRate = useMemo(() => {
    if (!selectedServiceId) return null
    for (const p of pages) {
      const r = p.find((x) => x.service_id === selectedServiceId)
      if (r) return r
    }
    return null
  }, [pages, selectedServiceId])

  const ratesMutation = useMutation({
    mutationFn: async (vars: { offset: number; openModalOnReady?: boolean }) => {
      if (!orderId) throw new Error("Missing orderId")

      const body = {
        offset: vars.offset,
        limit: 10,
        expected_ship_date_override: toJsonDate(shipDateISO),
        package_overrides: {
          unit_system: unitSystem,
          default_weight_g: defWeightG,
          default_l_cm: defLCm,
          default_w_cm: defWCm,
          default_h_cm: defHCm,
        },
      }

      return sdk.client.fetch<PostResp>(`/admin/orders/${orderId}/freightcom/rates`, {
        method: "POST",
        body,
      })
    },
    onSuccess: (r: PostResp, vars) => {
      setMeta({
        request_id: r.request_id,
        status: r.status === "ready" ? "ready" : "processing",
        status_meta: (r as any).status_meta,
        preview: (r as any).preview,
        rates_total: (r as any).rates_total,
        next_offset: (r as any).next_offset,
      })

      if (r.status === "ready") {
        const pageRates = (r.rates || []) as FreightcomRate[]
        const offset = vars.offset

        // update/append page by offset
        setPages((prev) => {
          const idx = cursorOffsets.indexOf(offset)
          if (idx >= 0) {
            const copy = [...prev]
            copy[idx] = pageRates
            return copy
          }
          return [...prev, pageRates]
        })

        setCursorOffsets((prev) => (prev.includes(offset) ? prev : [...prev, offset]))

        // move to page for this offset
        setPageIndex(() => {
          const idx = cursorOffsets.indexOf(offset)
          if (idx >= 0) return idx
          return cursorOffsets.length
        })

        // default select first if none
        if (!selectedServiceId && pageRates.length) setSelectedServiceId(pageRates[0].service_id)

        if (vars.openModalOnReady) {
          setStep(1)
          setIsModalOpen(true)
        }
      } else {
        setIsModalOpen(false)
      }
    },
  })

  // Poll while processing
  useEffect(() => {
    if (meta.status !== "processing") return
    const t = setTimeout(() => {
      ratesMutation.mutate({ offset: 0, openModalOnReady: true })
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.status])

  const startGetRates = () => {
    setPages([])
    setCursorOffsets([0])
    setPageIndex(0)
    setSelectedServiceId(null)
    setPaymentMethods([])
    setPaymentMethodId(null)
    setMeta({ request_id: null, status: "idle" })
    setStep(1)
    ratesMutation.mutate({ offset: 0, openModalOnReady: true })
  }

  // ✅ FIXED Next: prefer cached next page; otherwise fetch
  const goNextRatesPage = () => {
    if (!done) return
    const nextIndex = pageIndex + 1
    if (nextIndex < pages.length) {
      setPageIndex(nextIndex)
      return
    }

    const nextOffset = meta.next_offset ?? 0
    const existingIdx = cursorOffsets.indexOf(nextOffset)
    if (existingIdx >= 0) {
      setPageIndex(existingIdx)
      return
    }

    ratesMutation.mutate({ offset: nextOffset, openModalOnReady: true })
  }

  const goPrevRatesPage = () => setPageIndex((p) => Math.max(0, p - 1))

  const loadPaymentMethods = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Missing orderId")
      return sdk.client.fetch<PaymentMethodsResp>(
        `/admin/orders/${orderId}/freightcom/payment-methods`
      )
    },
    onSuccess: (r) => {
      setPaymentMethods(r.methods || [])
      setPaymentMethodId((prev) => prev ?? r.methods?.[0]?.id ?? null)
    },
  })

  const bookShipment = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Missing orderId")
      if (!selectedRate?.service_id) throw new Error("Select a rate")
      if (!paymentMethodId) throw new Error("Select a payment method")

      return sdk.client.fetch(`/admin/orders/${orderId}/freightcom/shipments`, {
        method: "POST",
        body: {
          service_id: selectedRate.service_id,
          payment_method_id: paymentMethodId,
          expected_ship_date: toJsonDate(shipDateISO),
          package_overrides: {
            unit_system: unitSystem,
            default_weight_g: defWeightG,
            default_l_cm: defLCm,
            default_w_cm: defWCm,
            default_h_cm: defHCm,
          },
        },
      })
    },
  })

  const goToStep2 = async () => {
    if (!selectedRate?.service_id) return
    await loadPaymentMethods.mutateAsync()
    setStep(2)
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between px-6 py-4 gap-4">
        <div className="min-w-0">
          <Heading level="h2">Freightcom Rates</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Step 1: choose a rate • Step 2: choose payment + book shipment.
          </Text>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {headerBadge}
            {requestId ? (
              <Text size="small" className="text-ui-fg-subtle break-all">Request: {requestId}</Text>
            ) : null}
            {meta.status_meta ? (
              <Text size="small" className="text-ui-fg-subtle">
                {meta.status_meta.complete}/{meta.status_meta.total} complete
              </Text>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={startGetRates} disabled={!orderId || ratesMutation.isPending}>
            {ratesMutation.isPending ? "Working…" : "Get Rates"}
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 space-y-3">
        {(ratesMutation.isError || loadPaymentMethods.isError || bookShipment.isError) && (
          <Text size="small" className="text-ui-fg-error">
            {String(
              (ratesMutation.error as any)?.message ||
                (loadPaymentMethods.error as any)?.message ||
                (bookShipment.error as any)?.message ||
                "Error"
            )}
          </Text>
        )}

        {/* Destination preview BEFORE click */}
        <div className="rounded-md border border-ui-border-base p-3">
          <Text size="small" className="text-ui-fg-subtle">Destination (from order)</Text>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border border-ui-border-base p-2">
              <Text size="xsmall" className="text-ui-fg-subtle">Recipient</Text>
              <Text size="small">{destinationPreview.name}</Text>
              <Text size="small" className="text-ui-fg-subtle">Email: {destinationPreview.email}</Text>
            </div>
            <div className="rounded border border-ui-border-base p-2">
              <Text size="xsmall" className="text-ui-fg-subtle">Address</Text>
              <Text size="small">{destinationPreview.address.address_line_1}</Text>
              <Text size="small" className="text-ui-fg-subtle">
                {destinationPreview.address.city}, {destinationPreview.address.region} {destinationPreview.address.postal_code}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">{destinationPreview.address.country}</Text>
            </div>
          </div>
        </div>

        {/* Ship date + defaults */}
        <div className="rounded-md border border-ui-border-base p-3 space-y-3">
          <Text size="small" className="text-ui-fg-subtle">Shipment settings</Text>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">Expected ship date</Text>
              <input
                type="date"
                className="w-full border rounded px-2 py-1"
                value={shipDateISO}
                onChange={(e) => setShipDateISO(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <Text size="xsmall" className="text-ui-fg-subtle">Units</Text>
              <div className="flex items-center gap-3 flex-wrap mt-1">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={unitSystem === "metric"} onChange={() => setUnitSystem("metric")} />
                  Metric (cm/kg)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={unitSystem === "imperial"} onChange={() => setUnitSystem("imperial")} />
                  Imperial (in/lb)
                </label>
              </div>
            </div>
          </div>

          <Text size="xsmall" className="text-ui-fg-subtle">
            Package defaults used when variant dims/weight are missing
          </Text>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">Default weight (g)</Text>
              <input className="w-full border rounded px-2 py-1" value={defWeightG} onChange={(e) => setDefWeightG(Number(e.target.value || 0))} />
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">L (cm)</Text>
              <input className="w-full border rounded px-2 py-1" value={defLCm} onChange={(e) => setDefLCm(Number(e.target.value || 0))} />
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">W (cm)</Text>
              <input className="w-full border rounded px-2 py-1" value={defWCm} onChange={(e) => setDefWCm(Number(e.target.value || 0))} />
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">H (cm)</Text>
              <input className="w-full border rounded px-2 py-1" value={defHCm} onChange={(e) => setDefHCm(Number(e.target.value || 0))} />
            </div>
          </div>
        </div>

        {/* Backend preview (after click) */}
        <div className="rounded-md border border-ui-border-base p-3">
          <Text size="small" className="text-ui-fg-subtle">Backend preview (generated after Get Rates)</Text>
          {!meta.preview ? (
            <Text size="small" className="text-ui-fg-subtle mt-2">
              Click <span className="font-medium">Get Rates</span> to generate payload preview.
            </Text>
          ) : (
            <pre className="text-xs mt-2 p-2 bg-ui-bg-subtle rounded overflow-auto max-h-48">
{JSON.stringify(meta.preview, null, 2)}
            </pre>
          )}
          {requestId && !done && (
            <Text size="small" className="text-ui-fg-subtle mt-2">
              Processing… modal will open automatically when ready.
            </Text>
          )}
        </div>
      </div>

      {/* Full page modal */}
      <FocusModal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <FocusModal.Content className="h-[95vh] w-[95vw] max-w-none overflow-hidden">
          <FocusModal.Header>
            <div className="flex items-center justify-between w-full">
              <Heading level="h2">
                {step === 1 ? "Step 1 — Select Rate" : "Step 2 — Payment + Book"}
              </Heading>

              <div className="flex items-center gap-2">
                <FocusModal.Close asChild>
                  <Button size="small" variant="secondary">Close</Button>
                </FocusModal.Close>
              </div>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="p-6 overflow-y-auto h-[calc(95vh-64px)]">
            {/* Stepper */}
            <div className="flex items-center gap-2 mb-4">
              <Badge size="small" color={step === 1 ? "blue" : "grey"}>1</Badge>
              <Text size="small" className={step === 1 ? "" : "text-ui-fg-subtle"}>Rate</Text>
              <Text size="small" className="text-ui-fg-subtle">→</Text>
              <Badge size="small" color={step === 2 ? "blue" : "grey"}>2</Badge>
              <Text size="small" className={step === 2 ? "" : "text-ui-fg-subtle"}>Payment</Text>
            </div>

            {/* Selected pinned */}
            <div className="mb-4 rounded-md border border-ui-border-base p-3">
              <Text size="small" className="text-ui-fg-subtle">Selected rate</Text>
              {selectedRate ? (
                <>
                  <Text className="font-medium">
                    {(selectedRate.carrier_name || "Carrier")} • {(selectedRate.service_name || selectedRate.service_id)}
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    Total: {moneyLabel(selectedRate.total)} • Transit:{" "}
                    {selectedRate.transit_time_not_available ? "N/A" : `${selectedRate.transit_time_days} days`} • Valid:{" "}
                    {formatJsonDate(selectedRate.valid_until)}
                  </Text>
                </>
              ) : (
                <Text size="small" className="text-ui-fg-subtle">Pick one below.</Text>
              )}
            </div>

            {/* STEP 1 */}
            {step === 1 && (
              <>
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Text size="small" className="text-ui-fg-subtle">
                      Page {pageIndex + 1} / {Math.max(1, pages.length)} • Showing {currentRates.length} / {meta.rates_total ?? "?"}
                    </Text>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={goPrevRatesPage}
                      disabled={pageIndex === 0 || ratesMutation.isPending}
                    >
                      Prev
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={goNextRatesPage}
                      disabled={!done || ratesMutation.isPending}
                    >
                      Next
                    </Button>

                    <Button
                      size="small"
                      onClick={goToStep2}
                      disabled={!selectedRate || loadPaymentMethods.isPending}
                    >
                      {loadPaymentMethods.isPending ? "Loading…" : "Continue"}
                    </Button>
                  </div>
                </div>

                {!done ? (
                  <Text size="small" className="text-ui-fg-subtle">Processing…</Text>
                ) : currentRates.length === 0 ? (
                  <Text size="small" className="text-ui-fg-subtle">No rates returned.</Text>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {currentRates.map((r) => {
                      const isSelected = selectedServiceId === r.service_id
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
                                {(r.carrier_name || "Carrier")} • {(r.service_name || r.service_id)}
                              </Text>
                              <Text size="small" className="text-ui-fg-subtle break-all">{r.service_id}</Text>
                            </div>
                            {r.paperless ? (
                              <Badge size="small" color="green">Paperless</Badge>
                            ) : (
                              <Badge size="small" color="grey">Std</Badge>
                            )}
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="rounded border border-ui-border-base p-2">
                              <Text size="xsmall" className="text-ui-fg-subtle">Total</Text>
                              <Text className="font-medium">{moneyLabel(r.total)}</Text>
                              <Text size="xsmall" className="text-ui-fg-subtle">Base: {moneyLabel(r.base)}</Text>
                            </div>
                            <div className="rounded border border-ui-border-base p-2">
                              <Text size="xsmall" className="text-ui-fg-subtle">Transit</Text>
                              <Text className="font-medium">
                                {r.transit_time_not_available ? "N/A" : `${r.transit_time_days} days`}
                              </Text>
                              <Text size="xsmall" className="text-ui-fg-subtle">Valid: {formatJsonDate(r.valid_until)}</Text>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-md border border-ui-border-base p-3">
                  <Text size="small" className="text-ui-fg-subtle">Payment method</Text>

                  {paymentMethods.length === 0 ? (
                    <Text size="small" className="text-ui-fg-subtle mt-2">
                      No payment methods returned.
                    </Text>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {paymentMethods.map((m) => (
                        <label key={m.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            checked={paymentMethodId === m.id}
                            onChange={() => setPaymentMethodId(m.id)}
                          />
                          {m.label} <span className="text-ui-fg-subtle">({m.id})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-ui-border-base p-3">
                  <Text size="small" className="text-ui-fg-subtle">Confirm expected ship date</Text>
                  <Text size="small" className="mt-1">
                    {shipDateISO} (sent as {JSON.stringify(toJsonDate(shipDateISO))})
                  </Text>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>

                  <Button
                    onClick={() => bookShipment.mutate()}
                    disabled={!selectedRate || !paymentMethodId || bookShipment.isPending}
                  >
                    {bookShipment.isPending ? "Booking…" : "Book Shipment"}
                  </Button>
                </div>

                {bookShipment.isSuccess && (
                  <div className="rounded-md border border-ui-border-base p-3">
                    <Text className="font-medium">Shipment booked</Text>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                      Backend returned data (check logs / response).
                    </Text>
                  </div>
                )}
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