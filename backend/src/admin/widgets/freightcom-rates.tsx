import { useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Text, Badge, FocusModal } from "@medusajs/ui"
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

type PostResp =
  | { request_id: string; status: "processing"; status_meta?: any; preview?: Preview }
  | {
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
  if (Number.isFinite(cents)) return `${(Math.round(cents) / 100).toFixed(2)} ${m.currency || ""}`.trim()
  return `${m.value} ${m.currency || ""}`.trim()
}

export default function FreightcomRatesWidget({ data }: any) {
  const order = getOrderFromWidgetData(data)
  const orderId = order?.id

  const [resp, setResp] = useState<PostResp | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  // package override fields (simple version)
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric")
  const [defWeightG, setDefWeightG] = useState(500)
  const [defLCm, setDefLCm] = useState(20)
  const [defWCm, setDefWCm] = useState(15)
  const [defHCm, setDefHCm] = useState(10)

  const requestId = resp?.request_id

  const callRates = useMutation({
    mutationFn: async (vars: { offset?: number }) => {
      if (!orderId) throw new Error("Missing orderId")

      const body = {
        offset: vars.offset ?? 0,
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
    onSuccess: (r) => {
      setResp(r)

      if (r.status === "ready" && Array.isArray(r.rates) && r.rates.length) {
        // open modal when ready
        setSelectedServiceId((prev) => prev ?? r.rates![0].service_id)
        setIsModalOpen(true)
      } else {
        // processing: keep modal closed
        setIsModalOpen(false)
      }
    },
  })

  // If processing, keep polling until ready (same request “session” on your backend)
  useEffect(() => {
    if (!resp) return
    if (resp.status !== "processing") return
    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      // call again (offset 0) to get ready + top 10
      callRates.mutate({ offset: 0 })
    }

    const t = setTimeout(tick, 1200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resp?.status])

  const done = resp?.status === "ready"
  const preview = resp?.preview
  const rates = (resp && resp.status === "ready" ? resp.rates || [] : []) as FreightcomRate[]

  const headerBadge = useMemo(() => {
    if (!requestId) return <Badge size="small" color="grey">Not started</Badge>
    if (done) return <Badge size="small" color="green">Ready</Badge>
    return <Badge size="small" color="orange">Processing</Badge>
  }, [requestId, done])

  const selectedRate = useMemo(() => {
    if (!selectedServiceId) return null
    return rates.find((r) => r.service_id === selectedServiceId) || null
  }, [rates, selectedServiceId])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between px-6 py-4 gap-4">
        <div className="min-w-0">
          <Heading level="h2">Freightcom Rates</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Get top shipping options (10 at a time). Refresh to see other options.
          </Text>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {headerBadge}
            {requestId ? (
              <Text size="small" className="text-ui-fg-subtle break-all">Request: {requestId}</Text>
            ) : null}
            {resp?.status_meta ? (
              <Text size="small" className="text-ui-fg-subtle">
                {resp.status_meta.complete}/{resp.status_meta.total} complete
              </Text>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => callRates.mutate({ offset: 0 })} disabled={!orderId || callRates.isPending}>
            {callRates.isPending ? "Working…" : "Get Rates"}
          </Button>
        </div>
      </div>

      {/* Package override fields */}
      <div className="px-6 py-4 space-y-3">
        {callRates.isError && (
          <Text size="small" className="text-ui-fg-error">
            {String((callRates.error as any)?.message || "Error")}
          </Text>
        )}

        <div className="rounded-md border border-ui-border-base p-3 space-y-3">
          <Text size="small" className="text-ui-fg-subtle">Package defaults (used when product variant dims/weight are missing)</Text>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={unitSystem === "metric"}
                onChange={() => setUnitSystem("metric")}
              />
              Metric (cm/kg)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={unitSystem === "imperial"}
                onChange={() => setUnitSystem("imperial")}
              />
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

        {/* Preview panel from backend (fixes 0/0/0) */}
        <div className="rounded-md border border-ui-border-base p-3">
          <Text size="small" className="text-ui-fg-subtle">What will be sent to Freightcom (backend preview)</Text>

          {!preview ? (
            <Text size="small" className="text-ui-fg-subtle mt-2">
              Click <span className="font-medium">Get Rates</span> to generate a preview.
            </Text>
          ) : (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded border border-ui-border-base p-2">
                <Text size="xsmall" className="text-ui-fg-subtle">Origin</Text>
                <Text size="small">{preview.origin?.name}</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {preview.origin?.address?.unit_number} {preview.origin?.address?.address_line_1},{" "}
                  {preview.origin?.address?.city} {preview.origin?.address?.region} {preview.origin?.address?.postal_code}
                </Text>
              </div>

              <div className="rounded border border-ui-border-base p-2">
                <Text size="xsmall" className="text-ui-fg-subtle">Destination</Text>
                <Text size="small">{preview.destination?.name}</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {preview.destination?.address?.address_line_1},{" "}
                  {preview.destination?.address?.city} {preview.destination?.address?.region} {preview.destination?.address?.postal_code}
                </Text>
              </div>

              <div className="rounded border border-ui-border-base p-2 md:col-span-2">
                <Text size="xsmall" className="text-ui-fg-subtle">Package debug</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  Items: {preview.package_debug?.total_items ?? "—"} • Defaults used for: {preview.package_debug?.used_defaults_for ?? "—"} • Sum weight(g): {Math.round(preview.package_debug?.sum_weight_g ?? 0)}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle mt-2">Sample packages</Text>
                <pre className="text-xs mt-1 p-2 bg-ui-bg-subtle rounded overflow-auto max-h-40">
{JSON.stringify(preview.packages_preview ?? [], null, 2)}
                </pre>
              </div>
            </div>
          )}

          {requestId && !done && (
            <Text size="small" className="text-ui-fg-subtle mt-2">
              Processing… modal will open automatically when ready.
            </Text>
          )}
        </div>
      </div>

      {/* Modal */}
      <FocusModal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <FocusModal.Content className="max-h-[85vh] overflow-hidden">
          <FocusModal.Header>
            <div className="flex items-center justify-between w-full">
              <Heading level="h2">Top Shipping Options</Heading>
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => {
                    // refresh shows next 10 options
                    if (resp && resp.status === "ready") {
                      callRates.mutate({ offset: resp.next_offset ?? 0 })
                    }
                  }}
                  disabled={!done || callRates.isPending}
                >
                  Refresh Rates
                </Button>

                <FocusModal.Close asChild>
                  <Button size="small" variant="secondary">Close</Button>
                </FocusModal.Close>
              </div>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="p-6 overflow-y-auto max-h-[70vh]">
            {!done ? (
              <Text size="small" className="text-ui-fg-subtle">Processing…</Text>
            ) : rates.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">No rates returned.</Text>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {rates.map((r) => {
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

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div className="rounded border border-ui-border-base p-2">
                          <Text size="xsmall" className="text-ui-fg-subtle">Total</Text>
                          <Text className="font-medium">{moneyLabel(r.total)}</Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">Base: {moneyLabel(r.base)}</Text>
                        </div>

                        <div className="rounded border border-ui-border-base p-2">
                          <Text size="xsmall" className="text-ui-fg-subtle">Transit</Text>
                          <Text className="font-medium">{r.transit_time_not_available ? "N/A" : `${r.transit_time_days} days`}</Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">Valid: {formatJsonDate(r.valid_until)}</Text>
                        </div>

                        <div className="rounded border border-ui-border-base p-2">
                          <Text size="xsmall" className="text-ui-fg-subtle">Rank pool</Text>
                          <Text size="small" className="text-ui-fg-subtle">
                            Showing 10 / {resp?.status === "ready" ? resp.rates_total ?? "?" : "?"}
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
                <Text size="small" className="text-ui-fg-subtle">Selected (we’ll wire the next steps after)</Text>
                <Text className="font-medium">
                  {(selectedRate.carrier_name || "Carrier")} • {(selectedRate.service_name || selectedRate.service_id)}
                </Text>
                <Text size="small" className="text-ui-fg-subtle">Total: {moneyLabel(selectedRate.total)}</Text>
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
