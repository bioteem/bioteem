import { useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Text, RadioGroup, Badge } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

type Rate = Record<string, any>

function getOrderFromWidgetData(data: any) {
  // order widgets can pass different shapes
  return data?.order ?? data?.resource ?? (data?.id ? data : null)
}

export default function FreightcomRatesWidget({ data }: any) {
  const order = getOrderFromWidgetData(data)
  const orderId = order?.id

  const queryClient = useQueryClient()

  const [rateId, setRateId] = useState<string | null>(null)
  const [rates, setRates] = useState<Rate[]>([])
  const [selectedKey, setSelectedKey] = useState<string>("")
  const [status, setStatus] = useState<"idle" | "processing" | "ready" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const prettyRates = useMemo(() => {
    return (rates || []).map((r, idx) => {
      // Try common keys; fallback to index
      const key = String(r.id ?? r.rate_id ?? r.service_id ?? idx)

      const carrier = r.carrier_name ?? r.carrier ?? r.carrierCode ?? "Carrier"
      const service = r.service_name ?? r.service ?? r.serviceName ?? "Service"
      const price = r.total_price ?? r.total ?? r.price ?? r.amount ?? "?"
      const currency = r.currency ?? r.currency_code ?? ""
      const eta = r.eta ?? r.delivery_estimate ?? r.transit_time ?? ""

      return {
        key,
        label: `${carrier} • ${service} • ${price} ${currency}${eta ? ` • ${eta}` : ""}`,
        raw: r,
      }
    })
  }, [rates])

  const getRatesMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Missing orderId")
      return sdk.client.fetch(`/admin/orders/${orderId}/freightcom/rates`, {
        method: "POST",
      })
    },
    onMutate: () => {
      setError(null)
      setStatus("processing")
      setRates([])
      setSelectedKey("")
    },
    onSuccess: (res: any) => {
      if (res?.rate_id) setRateId(res.rate_id)

      // If backend returned 202, it may return only {rate_id}
      if (!Array.isArray(res?.rates)) {
        setStatus("processing")
        return
      }

      setRates(res.rates)
      setStatus("ready")

      // optional: invalidate something if you later persist rates to metadata
      queryClient.invalidateQueries({ queryKey: ["order", orderId] })
    },
    onError: (e: any) => {
      setStatus("error")
      setError(e?.message || "Failed to fetch rates")
    },
  })

  // Nice UX: when we’re "processing", show a hint to click again
  useEffect(() => {
    if (status === "processing" && rateId) {
      // nothing required; just lets UI show "processing"
    }
  }, [status, rateId])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Freightcom Rates</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Quote shipping rates for this order using its shipping address + variant shipping fields.
          </Text>

          <div className="mt-2 flex items-center gap-2">
            {status === "ready" && <Badge size="small" color="green">Ready</Badge>}
            {status === "processing" && <Badge size="small" color="orange">Processing</Badge>}
            {status === "error" && <Badge size="small" color="red">Error</Badge>}
            {rateId ? (
              <Text size="small" className="text-ui-fg-subtle">
                Rate ID: {rateId}
              </Text>
            ) : null}
          </div>
        </div>

        <Button
          onClick={() => getRatesMutation.mutate()}
          disabled={!orderId || getRatesMutation.isPending}
        >
          {getRatesMutation.isPending ? "Getting…" : "Get Rates"}
        </Button>
      </div>

      <div className="px-6 py-4">
        {error ? (
          <Text size="small" className="text-ui-fg-error">
            {error}
          </Text>
        ) : null}

        {status === "processing" && (
          <Text size="small" className="text-ui-fg-subtle">
            Freightcom is still generating rates. Click <span className="font-medium">Get Rates</span> again in a moment.
          </Text>
        )}

        {prettyRates.length === 0 && status !== "processing" && (
          <Text size="small" className="text-ui-fg-subtle">
            No rates loaded yet.
          </Text>
        )}

        {prettyRates.length > 0 && (
          <RadioGroup value={selectedKey} onValueChange={setSelectedKey}>
            <div className="flex flex-col gap-2">
              {prettyRates.map((r) => (
                <div key={r.key} className="flex items-center gap-2">
                  <RadioGroup.Item value={r.key} />
                  <label htmlFor={r.key} className="text-sm">{r.label}</label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )}

        <div className="mt-4">
          <Button variant="secondary" disabled={!selectedKey}>
            Select Rate (next step)
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})
