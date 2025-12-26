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
  surcharges?: any[]
  taxes?: any[]
  [k: string]: any
}

type Preview = {
  origin: any
  destination: any
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

function getOrderFromWidgetData(data: any) {
  return data?.order ?? data?.resource ?? data ?? null
}

function formatJsonDate(d?: JsonDate) {
  if (!d) return "—"
  const mm = String(d.month).padStart(2, "0")
  const dd = String(d.day).padStart(2, "0")
  return `${d.year}-${mm}-${dd}`
}

// cents-as-string
function moneyLabel(m?: Money) {
  if (!m?.value) return "—"
  const cents = Number(m.value)
  if (Number.isFinite(cents)) {
    return `${(Math.round(cents) / 100).toFixed(2)} ${m.currency || ""}`.trim()
  }
  return `${m.value} ${m.currency || ""}`.trim()
}

export default function FreightcomRatesWidget({ data }: any) {
  const order = getOrderFromWidgetData(data)
  const orderId = order?.id

  // Package override fields
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric")
  const [defWeightG, setDefWeightG] = useState(500)
  const [defLCm, setDefLCm] = useState(20)
  const [defWCm, setDefWCm] = useState(15)
  const [defHCm, setDefHCm] = useState(10)

  // modal / selection
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  // Keep pages locally so refresh doesn't lose old options
  const [pages, setPages] = useState<FreightcomRate[][]>([])
  const [pageIndex, setPageIndex] = useState(0)

  // Tracking backend cursor
  const [cursorOffsets, setCursorOffsets] = useState<number[]>([0]) // offsets per page
  const [respMeta, setRespMeta] = useState<{
    request_id: string | null
    status: "idle" | "processing" | "ready"
    status_meta?: any
    preview?: Preview
    rates_total?: number
    next_offset?: number
  }>({ request_id: null, status: "idle" })

  const requestId = respMeta.request_id
  const done = respMeta.status === "ready"

  const ship = order?.shipping_address
  const destinationPreview = useMemo(() => {
    return {
      name:
        `${ship?.first_name || ""} ${ship?.last_name || ""}`.trim() || "Customer",
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

  const currentRates = pages[pageIndex] || []

  const selectedRate = useMemo(() => {
    if (!selectedServiceId) return null
    // search all pages so selection stays consistent
    for (const p of pages) {
      const r = p.find((x) => x.service_id === selectedServiceId)
      if (r) return r
    }
    return null
  }, [pages, selectedServiceId])

  const callRates = useMutation({
    mutationFn: async (vars: { offset: number; openModalOnReady?: boolean }) => {
      if (!orderId) throw new Error("Missing orderId")

      const body = {
        offset: vars.offset,
        limit: 10,
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
      setRespMeta((prev) => ({
        request_id: r.request_id,
        status: r.status === "ready" ? "ready" : "processing",
        status_meta: (r as any).status_meta,
        preview: (r as any).preview,
        rates_total: (r as any).rates_total,
        next_offset: (r as any).next_offset,
      }))

      if (r.status === "ready") {
        const pageRates = (r.rates || []) as FreightcomRate[]

        // if this offset already exists in cursorOffsets, replace that page
        setPages((prev) => {
          const idx = cursorOffsets.indexOf(vars.offset)
          if (idx >= 0) {
            const copy = [...prev]
            copy[idx] = pageRates
            return copy
          }
          // else append a new page
          return [...prev, pageRates]
        })

        setCursorOffsets((prev) => {
          if (prev.includes(vars.offset)) return prev
          return [...prev, vars.offset]
        })

        // set current page index to the page for this offset
        setPageIndex(() => {
          const idx = cursorOffsets.indexOf(vars.offset)
          if (idx >= 0) return idx
          return cursorOffsets.length // it will be appended
        })

        // select first option if nothing selected
        if (!selectedServiceId && pageRates.length) {
          setSelectedServiceId(pageRates[0].service_id)
        }

        if (vars.openModalOnReady) setIsModalOpen(true)
      } else {
        // keep modal closed while processing
        setIsModalOpen(false)
      }
    },
  })

  // Poll while processing (stay on offset 0)
  useEffect(() => {
    if (respMeta.status !== "processing") return
    let cancelled = false
    const t = setTimeout(() => {
      if (!cancelled) callRates.mutate({ offset: 0, openModalOnReady: true })
    }, 1200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respMeta.status])

  const startGetRates = () => {
    // reset pages for a new "session"
    setPages([])
    setCursorOffsets([0])
    setPageIndex(0)
    setSelectedServiceId(null)
    setRespMeta({ request_id: null, status: "idle" })

    callRates.mutate({ offset: 0, openModalOnReady: true })
  }

  const goNext = () => {
    if (!done) return
    const nextOffset = respMeta.next_offset ?? 0
    // If nextOffset already loaded, just move
    const idx = cursorOffsets.indexOf(nextOffset)
    if (idx >= 0) {
      setPageIndex(idx)
      return
    }
    callRates.mutate({ offset: nextOffset, openModalOnReady: true })
  }

  const goPrev = () => {
    setPageIndex((p) => Math.max(0, p - 1))
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between px-6 py-4 gap-4">
        <div className="min-w-0">
          <Heading level="h2">Freightcom Rates</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Get top shipping options (10 at a time). Use Next/Prev to page through.
          </Text>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {headerBadge}
            {requestId ? (
              <Text size="small" className="text-ui-fg-subtle break-all">
                Request: {requestId}
              </Text>
            ) : null}
            {respMeta.status_meta ? (
              <Text size="small" className="text-ui-fg-subtle">
                {respMeta.status_meta.complete}/{respMeta.status_meta.total} complete
              </Text>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={startGetRates} disabled={!orderId || callRates.isPending}>
            {callRates.isPending ? "Working…" : "Get Rates"}
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 space-y-3">
        {callRates.isError && (
          <Text size="small" className="text-ui-fg-error">
            {String((callRates.error as any)?.message || "Error")}
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
                {destinationPreview.address.city}, {destinationPreview.address.region}{" "}
                {destinationPreview.address.postal_code}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {destinationPreview.address.country}
              </Text>
            </div>
          </div>
        </div>

        {/* Package override fields */}
        <div className="rounded-md border border-ui-border-base p-3 space-y-3">
          <Text size="small" className="text-ui-fg-subtle">
            Package defaults (used when variant dims/weight are missing)
          </Text>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={unitSystem === "metric"} onChange={() => setUnitSystem("metric")} />
              Metric (cm/kg)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={unitSystem === "imperial"} onChange={() => setUnitSystem("imperial")} />
              Imperial (in/lb)
            </label>
          </div>

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
          <Text size="small" className="text-ui-fg-subtle">Backend preview (what will be sent)</Text>
          {!respMeta.preview ? (
            <Text size="small" className="text-ui-fg-subtle mt-2">
              Click <span className="font-medium">Get Rates</span> to generate the full payload preview.
            </Text>
          ) : (
            <pre className="text-xs mt-2 p-2 bg-ui-bg-subtle rounded overflow-auto max-h-48">
{JSON.stringify(respMeta.preview, null, 2)}
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
              <Heading level="h2">Shipping Options</Heading>

              <div className="flex items-center gap-2">
                <Text size="small" className="text-ui-fg-subtle">
                  Page {pageIndex + 1} / {Math.max(1, pages.length)}
                </Text>

                <Button
                  size="small"
                  variant="secondary"
                  onClick={goPrev}
                  disabled={pageIndex === 0 || callRates.isPending}
                >
                  Prev
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={goNext}
                  disabled={!done || callRates.isPending}
                >
                  Next
                </Button>

                <FocusModal.Close asChild>
                  <Button size="small" variant="secondary">Close</Button>
                </FocusModal.Close>
              </div>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="p-6 overflow-y-auto h-[calc(95vh-64px)]">
            {/* Selected on top */}
            <div className="mb-4 rounded-md border border-ui-border-base p-3">
              <Text size="small" className="text-ui-fg-subtle">Selected</Text>
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
                <Text size="small" className="text-ui-fg-subtle">Pick one of the options below.</Text>
              )}
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
                          <Text size="small" className="text-ui-fg-subtle break-all">
                            {r.service_id}
                          </Text>
                        </div>
                        {r.paperless ? (
                          <Badge size="small" color="green">Paperless</Badge>
                        ) : (
                          <Badge size="small" color="grey">Std</Badge>
                        )}
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
                          <Text size="xsmall" className="text-ui-fg-subtle">Transit</Text>
                          <Text className="font-medium">
                            {r.transit_time_not_available ? "N/A" : `${r.transit_time_days} days`}
                          </Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            Valid: {formatJsonDate(r.valid_until)}
                          </Text>
                        </div>

                        <div className="rounded border border-ui-border-base p-2">
                          <Text size="xsmall" className="text-ui-fg-subtle">Pool</Text>
                          <Text size="small" className="text-ui-fg-subtle">
                            Showing {currentRates.length} / {respMeta.rates_total ?? "?"}
                          </Text>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <Text size="xsmall" className="text-ui-fg-subtle mt-6">
              Next step (creating shipment/label) will be wired after selection.
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
