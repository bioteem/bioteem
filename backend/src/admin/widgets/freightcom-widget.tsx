import { useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Button, Text, Badge, FocusModal, Heading } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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

type BookShipmentResp = {
  shipment_id: string
  previously_created?: boolean
  shipment?: any
  tracking_url?: string | null
  tracking_number?: string | null
  label_url?: string | null
}

type PickupTime = { hour: number; minute: number }
type PickupDate = JsonDate

type PickupScheduleBody = {
  pickup_details: {
    pre_scheduled_pickup: boolean
    date: PickupDate
    ready_at: PickupTime
    ready_until: PickupTime
    pickup_location?: string
    contact_name?: string
    contact_phone_number?: { number: string; extension?: string }
  }
  dispatch_details?: {
    date?: PickupDate
    ready_at?: PickupTime
    ready_until?: PickupTime
  }
}

type PickupStatusResp = {
  status?: string // e.g. "pending" etc.
  error?: string
  pickup_confirmation_number?: string
}

type PickupGetResp = {
  exists: boolean
  status?: string
  error?: string
  pickup_confirmation_number?: string
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

function toPickupDate(iso: string): PickupDate {
  return toJsonDate(iso)
}

function timeLabel(t?: PickupTime) {
  if (!t) return "—"
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`
}

function pickLabelUrlFromShipment(shipment: any): string | null {
  const labels = shipment?.labels
  if (Array.isArray(labels) && labels.length) return labels[0]?.url || null
  return shipment?.label_url || null
}

export default function FreightcomRatesWidget({ data }: any) {
  const fallbackOrder = getOrderFromWidgetData(data)
  const orderId = fallbackOrder?.id
  const qc = useQueryClient()

  // Always keep a fresh order object so metadata updates appear immediately
  const orderQuery = useQuery({
    queryKey: ["admin-order", orderId],
    enabled: !!orderId,
    queryFn: async () => sdk.client.fetch<any>(`/admin/orders/${orderId}`),
    staleTime: 2_500,
  })

  const refreshOrder = async () => {
  await qc.invalidateQueries({ queryKey: ["admin-order", orderId] })
}

const refreshShipment = async () => {
  await qc.invalidateQueries({ queryKey: ["freightcom-shipment", orderId, shipmentIdFromMeta] })
  await qc.invalidateQueries({ queryKey: ["freightcom-shipment-status", orderId, shipmentIdFromMeta] })
}

const refreshPickup = async () => {
  await qc.invalidateQueries({ queryKey: ["freightcom-pickup", orderId, shipmentIdFromMeta] })
  await refreshOrder()
}

  const order = orderQuery.data?.order ?? fallbackOrder

  // Single source of truth for shipment id
  const shipmentIdFromMeta = (order?.metadata?.freightcom_shipment_id as string | undefined) ?? null

  const pickupConfirmationFromMeta =
  (order?.metadata?.freightcom_pickup_confirmation_number as string | undefined) ?? null

const pickupStatusFromMeta =
  (order?.metadata?.freightcom_pickup_status as string | undefined) ?? null

const pickupLastScheduledAt =
  (order?.metadata?.freightcom_pickup_scheduled_at as string | undefined) ?? null

  // Package defaults
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric")
  const [defWeightG, setDefWeightG] = useState(500)
  const [defLCm, setDefLCm] = useState(20)
  const [defWCm, setDefWCm] = useState(15)
  const [defHCm, setDefHCm] = useState(10)

  // Ship date
  const [shipDateISO, setShipDateISO] = useState<string>(() => defaultShipDateISO())

  // Rates modal / stepper
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  // Selection
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  // Paging
  const [pages, setPages] = useState<FreightcomRate[][]>([])
  const [cursorOffsets, setCursorOffsets] = useState<number[]>([0])
  const [pageIndex, setPageIndex] = useState(0)
  const [offsetMeta, setOffsetMeta] = useState<Record<number, { next_offset?: number; rates_total?: number }>>({})

const [isPickupModalOpen, setIsPickupModalOpen] = useState(false)

// simple defaults
const [pickupDateISO, setPickupDateISO] = useState(() => defaultShipDateISO())
const [readyAt, setReadyAt] = useState<PickupTime>({ hour: 10, minute: 0 })
const [readyUntil, setReadyUntil] = useState<PickupTime>({ hour: 16, minute: 0 })
const [pickupLocation, setPickupLocation] = useState("Front desk")
const [pickupContactName, setPickupContactName] = useState("Warehouse")
const [pickupPhone, setPickupPhone] = useState("")
  // Meta
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

  // Shipment modal
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showRawShipment, setShowRawShipment] = useState(false)

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


  const selectedRate = useMemo(() => {
    if (!selectedServiceId) return null
    for (const p of pages) {
      const r = p.find((x) => x.service_id === selectedServiceId)
      if (r) return r
    }
    return null
  }, [pages, selectedServiceId])

const pickupQuery = useQuery({
  queryKey: ["freightcom-pickup", orderId, shipmentIdFromMeta],
  enabled: !!orderId && !!shipmentIdFromMeta && isPickupModalOpen,
  queryFn: async () => {
    return sdk.client.fetch<PickupGetResp>(
      `/admin/orders/${orderId}/freightcom/shipments/${shipmentIdFromMeta}/schedule`
    )
  },
  staleTime: 10_000,
})
const shipmentStatusQuery = useQuery({
  queryKey: ["freightcom-shipment-status", orderId, shipmentIdFromMeta],
  enabled: !!orderId && !!shipmentIdFromMeta,
  queryFn: async () => {
    const resp = await sdk.client.fetch<any>(
      `/admin/orders/${orderId}/freightcom/shipments/${shipmentIdFromMeta}`
    )
    const s = resp?.shipment ?? resp
    return s?.state ?? "unknown"
  },
  staleTime: 10_000,
})
  // Shipment details query (reload-safe)
  const shipmentQuery = useQuery({
    queryKey: ["freightcom-shipment", orderId, shipmentIdFromMeta],
    enabled: !!orderId && !!shipmentIdFromMeta && isShipmentModalOpen,
    queryFn: async () => {
      const resp = await sdk.client.fetch<any>(
        `/admin/orders/${orderId}/freightcom/shipments/${shipmentIdFromMeta}`
      )
      return resp?.shipment ?? resp
    },
    staleTime: 10_000,
  })

  const shipmentDetails = shipmentQuery.data ?? null

  const shipmentSummary = useMemo(() => {
    const s = shipmentDetails
    if (!s) return null
    const tracking_url = s.tracking_url ?? null
    const tracking_number =
      s.primary_tracking_number ?? (Array.isArray(s.tracking_numbers) ? s.tracking_numbers?.[0] : null) ?? null
    const label_url = pickLabelUrlFromShipment(s)
    return { tracking_url, tracking_number, label_url, state: s.state, id: s.id }
  }, [shipmentDetails])

  const resetRateFlow = () => {
    setPages([])
    setCursorOffsets([0])
    setPageIndex(0)
    setSelectedServiceId(null)
    setPaymentMethods([])
    setPaymentMethodId(null)
    setMeta({ request_id: null, status: "idle" })
    setStep(1)
    setOffsetMeta({})
  }
const headerBadge = useMemo(() => {
  // Shipment exists → show shipment state
  if (shipmentIdFromMeta) {
    if (shipmentStatusQuery.isPending) {
      return <Badge size="small" color="orange">Shipment: loading…</Badge>
    }
    return (
      <Badge size="small" color="green">
        Shipment: {shipmentStatusQuery.data}
      </Badge>
    )
  }

  // Otherwise fall back to rates flow
  if (!requestId) return <Badge size="small" color="grey">Not started</Badge>
  if (done) return <Badge size="small" color="green">Ready</Badge>
  return <Badge size="small" color="orange">Processing</Badge>
}, [
  shipmentIdFromMeta,
  shipmentStatusQuery.isPending,
  shipmentStatusQuery.data,
  requestId,
  done,
])

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

      if (r.status !== "ready") {
        setIsRatesModalOpen(false)
        return
      }

      const pageRates = (r.rates || []) as FreightcomRate[]
      const offset = vars.offset

      setOffsetMeta((prev) => ({
        ...prev,
        [offset]: {
          next_offset: (r as any).next_offset,
          rates_total: (r as any).rates_total,
        },
      }))

      setCursorOffsets((prevOffsets) => {
        const existingIdx = prevOffsets.indexOf(offset)
        const nextOffsets = existingIdx >= 0 ? prevOffsets : [...prevOffsets, offset]
        const pageIdx = existingIdx >= 0 ? existingIdx : nextOffsets.length - 1

        setPages((prevPages) => {
          const nextPages = [...prevPages]
          nextPages[pageIdx] = pageRates
          return nextPages
        })

        setPageIndex(pageIdx)
        return nextOffsets
      })

      if (!selectedServiceId && pageRates.length) setSelectedServiceId(pageRates[0].service_id)
      if (vars.openModalOnReady) {
        setStep(1)
        setIsRatesModalOpen(true)
      }
    },
  })
const schedulePickup = useMutation({
  mutationFn: async () => {
    if (!orderId) throw new Error("Missing orderId")
    if (!shipmentIdFromMeta) throw new Error("No shipment to schedule pickup for.")

    const body: PickupScheduleBody = {
      pickup_details: {
        pre_scheduled_pickup: true,
        date: toPickupDate(pickupDateISO),
        ready_at: readyAt,
        ready_until: readyUntil,
        pickup_location: pickupLocation || undefined,
        contact_name: pickupContactName || undefined,
        contact_phone_number: pickupPhone ? { number: pickupPhone } : undefined,
      },
    }

    return sdk.client.fetch<any>(
      `/admin/orders/${orderId}/freightcom/shipments/${shipmentIdFromMeta}/schedule`,
      { method: "POST", body }
    )
  },
  onSuccess: async () => {
    // backend writes snapshot into metadata
    await qc.invalidateQueries({ queryKey: ["admin-order", orderId] })
    await qc.invalidateQueries({ queryKey: ["freightcom-pickup", orderId, shipmentIdFromMeta] })
  },
})

const cancelPickup = useMutation({
  mutationFn: async () => {
    if (!orderId) throw new Error("Missing orderId")
    if (!shipmentIdFromMeta) throw new Error("No shipment on this order.")

    return sdk.client.fetch<any>(
      `/admin/orders/${orderId}/freightcom/shipments/${shipmentIdFromMeta}/schedule`,
      { method: "DELETE" }
    )
  },
  onSuccess: async () => {
    // backend clears pickup metadata keys
    await qc.invalidateQueries({ queryKey: ["admin-order", orderId] })
    await qc.invalidateQueries({ queryKey: ["freightcom-pickup", orderId, shipmentIdFromMeta] })
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
    resetRateFlow()
    setShowPreview(false)
    ratesMutation.mutate({ offset: 0, openModalOnReady: true })
  }

  const goNextRatesPage = () => {
    if (!done) return

    const nextIndex = pageIndex + 1
    if (nextIndex < pages.length) {
      setPageIndex(nextIndex)
      return
    }

    const currentOffset = cursorOffsets[pageIndex] ?? 0
    const nextOffset = offsetMeta[currentOffset]?.next_offset
    if (typeof nextOffset !== "number") return

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
      return sdk.client.fetch<PaymentMethodsResp>(`/admin/orders/${orderId}/freightcom/payment-methods`)
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

      return sdk.client.fetch<BookShipmentResp>(`/admin/orders/${orderId}/freightcom/shipments`, {
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
          carrier_name: selectedRate.carrier_name,
          service_name: selectedRate.service_name,
          quoted_total: selectedRate.total,
        },
      })
    },
    onSuccess: async () => {
      // get latest metadata immediately (shipment id, tracking, etc.)
      await qc.invalidateQueries({ queryKey: ["admin-order", orderId] })

      // open shipment modal; shipmentQuery will fetch with new shipment id
      setShowRawShipment(false)
      setIsShipmentModalOpen(true)

      // close rates flow
      setIsRatesModalOpen(false)
    },
  })

  const cancelShipment = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Missing orderId")
      if (!shipmentIdFromMeta) throw new Error("Missing shipmentId")

      return sdk.client.fetch<any>(
        `/admin/orders/${orderId}/freightcom/shipments/${shipmentIdFromMeta}/cancel`,
        { method: "POST" }
      )
    },
    onSuccess: async () => {
      // Close shipment modal and wipe local UI state
      setIsShipmentModalOpen(false)
      setIsRatesModalOpen(false)
      setShowRawShipment(false)
      setShowPreview(false)
      resetRateFlow()

      // Pull fresh metadata (so shipmentId becomes null -> button disables)
      await qc.invalidateQueries({ queryKey: ["admin-order", orderId] })
      await qc.invalidateQueries({ queryKey: ["freightcom-shipment", orderId] })
    },
  })

  const goToStep2 = async () => {
    if (!selectedRate?.service_id) return
    await loadPaymentMethods.mutateAsync()
    setStep(2)
  }

  const anyError =
    (ratesMutation.error as any)?.message ||
    (loadPaymentMethods.error as any)?.message ||
    (bookShipment.error as any)?.message ||
    (cancelShipment.error as any)?.message ||
    (shipmentQuery.error as any)?.message ||
    null

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
            {requestId ? <Text size="small" className="text-ui-fg-subtle break-all">Request: {requestId}</Text> : null}
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

          <Button
            variant="secondary"
            onClick={() => setIsShipmentModalOpen(true)}
            disabled={!shipmentIdFromMeta || orderQuery.isPending}
          >
            {orderQuery.isPending ? "Loading…" : "View Shipment"}
          </Button>
          <Button
  variant="secondary"
  onClick={() => setIsPickupModalOpen(true)}
  disabled={!shipmentIdFromMeta || orderQuery.isPending}
>
  Pickup
</Button>
        </div>
      </div>

      <div className="px-6 py-4 space-y-3">
        {anyError && <Text size="small" className="text-ui-fg-error">{String(anyError)}</Text>}

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

        <div className="rounded-md border border-ui-border-base p-3">
          <div className="flex items-center justify-between gap-2">
            <Text size="small" className="text-ui-fg-subtle">Backend preview</Text>
            <Button size="small" variant="secondary" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? "Hide" : "Show"}
            </Button>
          </div>

          {!showPreview ? null : !meta.preview ? (
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

      {/* Rates modal */}
      <FocusModal open={isRatesModalOpen} onOpenChange={setIsRatesModalOpen}>
        <FocusModal.Content className="h-[95vh] w-[95vw] max-w-none overflow-hidden">
          <FocusModal.Header>
            <div className="flex items-center justify-between w-full">
              <FocusModal.Title>
                {step === 1 ? "Step 1 — Select Rate" : "Step 2 — Payment + Book"}
              </FocusModal.Title>
              <FocusModal.Close asChild>
                <Button size="small" variant="secondary">Close</Button>
              </FocusModal.Close>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="p-6 overflow-y-auto h-[calc(95vh-64px)]">
            <div className="flex items-center gap-2 mb-4">
              <Badge size="small" color={step === 1 ? "blue" : "grey"}>1</Badge>
              <Text size="small" className={step === 1 ? "" : "text-ui-fg-subtle"}>Rate</Text>
              <Text size="small" className="text-ui-fg-subtle">→</Text>
              <Badge size="small" color={step === 2 ? "blue" : "grey"}>2</Badge>
              <Text size="small" className={step === 2 ? "" : "text-ui-fg-subtle"}>Payment</Text>
            </div>

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

            {step === 1 && (
              <>
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <Text size="small" className="text-ui-fg-subtle">
                    Page {pageIndex + 1} / {Math.max(1, pages.length)} • Showing {currentRates.length} /{" "}
                    {offsetMeta[cursorOffsets[pageIndex] ?? 0]?.rates_total ?? meta.rates_total ?? "?"}
                  </Text>

                  <div className="flex items-center gap-2">
                    <Button size="small" variant="secondary" onClick={goPrevRatesPage} disabled={pageIndex === 0 || ratesMutation.isPending}>
                      Prev
                    </Button>
                    <Button size="small" variant="secondary" onClick={goNextRatesPage} disabled={!done || ratesMutation.isPending}>
                      Next
                    </Button>
                    <Button size="small" onClick={goToStep2} disabled={!selectedRate || loadPaymentMethods.isPending}>
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
                            isSelected ? "border-ui-fg-base bg-ui-bg-base" : "border-ui-border-base hover:border-ui-fg-subtle",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Text className="font-medium">
                                {(r.carrier_name || "Carrier")} • {(r.service_name || r.service_id)}
                              </Text>
                              <Text size="small" className="text-ui-fg-subtle break-all">{r.service_id}</Text>
                            </div>
                            {r.paperless ? <Badge size="small" color="green">Paperless</Badge> : <Badge size="small" color="grey">Std</Badge>}
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

            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-md border border-ui-border-base p-3">
                  <Text size="small" className="text-ui-fg-subtle">Payment method</Text>

                  {paymentMethods.length === 0 ? (
                    <Text size="small" className="text-ui-fg-subtle mt-2">No payment methods returned.</Text>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {paymentMethods.map((m) => (
                        <label key={m.id} className="flex items-center gap-2 text-sm">
                          <input type="radio" checked={paymentMethodId === m.id} onChange={() => setPaymentMethodId(m.id)} />
                          {m.label} <span className="text-ui-fg-subtle">({m.id})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-ui-border-base p-3">
                  <Text size="small" className="text-ui-fg-subtle">Confirm expected ship date</Text>
                  <Text size="small" className="mt-1">{shipDateISO}</Text>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                  <Button onClick={() => bookShipment.mutate()} disabled={!selectedRate || !paymentMethodId || bookShipment.isPending}>
                    {bookShipment.isPending ? "Booking…" : "Book Shipment"}
                  </Button>
                </div>
              </div>
            )}
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>

      {/* Shipment modal */}
      <FocusModal open={isShipmentModalOpen} onOpenChange={setIsShipmentModalOpen}>
        <FocusModal.Content className="h-[95vh] w-[95vw] max-w-none overflow-hidden">
          <FocusModal.Header>
            <div className="flex items-center justify-between w-full">
              <FocusModal.Title>Shipment</FocusModal.Title>
              <FocusModal.Close asChild>
                <Button size="small" variant="secondary">Close</Button>
              </FocusModal.Close>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="p-6 overflow-y-auto h-[calc(95vh-64px)]">
            {!shipmentIdFromMeta ? (
              <Text size="small" className="text-ui-fg-subtle">No shipment id found yet.</Text>
            ) : shipmentQuery.isPending ? (
              <Text size="small" className="text-ui-fg-subtle">Loading shipment details…</Text>
            ) : shipmentQuery.isError ? (
              <Text size="small" className="text-ui-fg-error">
                {String((shipmentQuery.error as any)?.message || "Error")}
              </Text>
            ) : !shipmentDetails ? (
              <Text size="small" className="text-ui-fg-subtle">No shipment details returned.</Text>
            ) : shipmentSummary ? (
              <div className="space-y-3">
                <div className="rounded-md border border-ui-border-base p-3">
                  <Text size="small" className="text-ui-fg-subtle">Shipment ID</Text>
                  <Text className="font-medium break-all">{shipmentSummary.id}</Text>
                  <Text size="small" className="text-ui-fg-subtle">State: {shipmentSummary.state || "—"}</Text>
                </div>

                <div className="rounded-md border border-ui-border-base p-3">
                  <Text size="small" className="text-ui-fg-subtle">Tracking</Text>
                  <Text size="small">
                    Tracking number: <span className="font-medium">{shipmentSummary.tracking_number || "—"}</span>
                  </Text>
                  <Text size="small">
                    Tracking URL:{" "}
                    {shipmentSummary.tracking_url ? (
                      <a className="underline" href={shipmentSummary.tracking_url} target="_blank" rel="noreferrer">
                        Open tracking
                      </a>
                    ) : "—"}
                  </Text>
                </div>

                <div className="rounded-md border border-ui-border-base p-3">
                  <Text size="small" className="text-ui-fg-subtle">Label</Text>
                  <Text size="small">
                    Label URL:{" "}
                    {shipmentSummary.label_url ? (
                      <a className="underline" href={shipmentSummary.label_url} target="_blank" rel="noreferrer">
                        Open label (PDF)
                      </a>
                    ) : "—"}
                  </Text>
                </div>

                <div className="flex items-center gap-2">
                  <Button
  variant="secondary"
  onClick={refreshShipment}
  disabled={shipmentQuery.isPending}
>
  Refresh
</Button>

                  <Button
                    variant="danger"
                    onClick={() => cancelShipment.mutate()}
                    disabled={cancelShipment.isPending}
                  >
                    {cancelShipment.isPending ? "Cancelling…" : "Cancel Shipment"}
                  </Button>
                </div>

                <div className="rounded-md border border-ui-border-base p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Text size="small" className="text-ui-fg-subtle">Raw shipment</Text>
                    <Button size="small" variant="secondary" onClick={() => setShowRawShipment((v) => !v)}>
                      {showRawShipment ? "Hide" : "Show"}
                    </Button>
                  </div>

                  {!showRawShipment ? null : (
                    <pre className="text-xs mt-2 p-2 bg-ui-bg-subtle rounded overflow-auto max-h-96">
                      {JSON.stringify(shipmentDetails, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-subtle">No shipment details returned.</Text>
            )}
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>

      <FocusModal open={isPickupModalOpen} onOpenChange={setIsPickupModalOpen}>
  <FocusModal.Content className="h-[85vh] w-[95vw] max-w-none overflow-hidden">
    <FocusModal.Header>
      <div className="flex items-center justify-between w-full">
        <FocusModal.Title>Pickup</FocusModal.Title>
        <FocusModal.Close asChild>
          <Button size="small" variant="secondary">Close</Button>
        </FocusModal.Close>
      </div>
    </FocusModal.Header>

    <FocusModal.Body className="p-6 overflow-y-auto h-[calc(85vh-64px)]">
      {!shipmentIdFromMeta ? (
        <Text size="small" className="text-ui-fg-subtle">Book a shipment first.</Text>
      ) : (
        <div className="space-y-4">
          {/* Current pickup */}
          <div className="rounded-md border border-ui-border-base p-3">
            <div className="flex items-center justify-between gap-2">
              <Text size="small" className="text-ui-fg-subtle">Current pickup</Text>

              <div className="flex items-center gap-2">
                <Button
  size="small"
  variant="secondary"
  onClick={refreshPickup}
  disabled={pickupQuery.isPending}
>
  {pickupQuery.isPending ? "Refreshing…" : "Refresh"}
</Button>

                <Button
                  size="small"
                  variant="danger"
                  onClick={() => cancelPickup.mutate()}
                  disabled={cancelPickup.isPending}
                >
                  {cancelPickup.isPending ? "Cancelling…" : "Cancel pickup"}
                </Button>
              </div>
            </div>

{pickupQuery.isPending ? (
  <Text size="small" className="text-ui-fg-subtle mt-2">Loading…</Text>
) : pickupQuery.isError ? (
  <Text size="small" className="text-ui-fg-error mt-2">
    {String((pickupQuery.error as any)?.message || "Error")}
  </Text>
) : pickupQuery.data?.exists === false ? (
  <Text size="small" className="text-ui-fg-subtle mt-2">
    No pickup scheduled yet.
  </Text>
) : (
  <>
    <Text className="font-medium mt-2">
      Status: {pickupStatusFromMeta || pickupQuery.data?.status || "—"}
    </Text>

    <Text size="small" className="text-ui-fg-subtle">
      Confirmation: {pickupConfirmationFromMeta || pickupQuery.data?.pickup_confirmation_number || "—"}
    </Text>

    {pickupQuery.data?.error ? (
      <Text size="small" className="text-ui-fg-error mt-2">
        {pickupQuery.data.error}
      </Text>
    ) : null}
  </>
)}
          </div>

          {/* Schedule form */}
          <div className="rounded-md border border-ui-border-base p-3 space-y-3">
            <Text size="small" className="text-ui-fg-subtle">Schedule pickup</Text>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">Date</Text>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1"
                  value={pickupDateISO}
                  onChange={(e) => setPickupDateISO(e.target.value)}
                />
              </div>

              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">Ready at</Text>
                <input
                  type="time"
                  className="w-full border rounded px-2 py-1"
                  value={timeLabel(readyAt)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number)
                    setReadyAt({ hour: h, minute: m })
                  }}
                />
              </div>

              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">Ready until</Text>
                <input
                  type="time"
                  className="w-full border rounded px-2 py-1"
                  value={timeLabel(readyUntil)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number)
                    setReadyUntil({ hour: h, minute: m })
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">Pickup location</Text>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                />
              </div>

              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">Contact name</Text>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={pickupContactName}
                  onChange={(e) => setPickupContactName(e.target.value)}
                />
              </div>

              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">Contact phone</Text>
                <input
                  className="w-full border rounded px-2 py-1"
                  placeholder="902xxxxxxx"
                  value={pickupPhone}
                  onChange={(e) => setPickupPhone(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={() => schedulePickup.mutate()} disabled={schedulePickup.isPending}>
              {schedulePickup.isPending ? "Scheduling…" : "Schedule pickup"}
            </Button>

            {schedulePickup.isError ? (
              <Text size="small" className="text-ui-fg-error">
                {String((schedulePickup.error as any)?.message || "Error")}
              </Text>
            ) : null}

            {cancelPickup.isError ? (
              <Text size="small" className="text-ui-fg-error">
                {String((cancelPickup.error as any)?.message || "Error")}
              </Text>
            ) : null}
          </div>
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