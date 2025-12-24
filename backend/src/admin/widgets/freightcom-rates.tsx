import { useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, RadioGroup, Text } from "@medusajs/ui"

type Rate = {
  // we’ll render defensively since Freightcom’s exact fields vary by service
  id?: string
  service_name?: string
  carrier_name?: string
  total_price?: number
  currency?: string
  eta?: string
  [k: string]: any
}

export default function FreightcomRatesWidget(props: any) {
  // Dashboard passes data depending on zone; for order details zones, you typically get `data.order`
  const order = props?.data?.order

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rates, setRates] = useState<Rate[]>([])
  const [rateId, setRateId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>("")

  const prettyRates = useMemo(() => {
    return (rates || []).map((r, idx) => {
      const key = String(r.id ?? `${idx}`)
      const label =
        `${r.carrier_name ?? "Carrier"} • ${r.service_name ?? "Service"} • ` +
        `${r.total_price ?? "?"} ${r.currency ?? ""} ${r.eta ? `• ${r.eta}` : ""}`

      return { key, label, raw: r }
    })
  }, [rates])

  const fetchRates = async () => {
    if (!order?.id) return
    setLoading(true)
    setError(null)
    setRates([])
    setSelected("")

    try {
      const resp = await fetch(`/admin/orders/${order.id}/freightcom/rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })

      const json = await resp.json()

      if (resp.status === 202) {
        setRateId(json.rate_id)
        setError("Rates are still processing. Click “Get Rates” again in a moment.")
        return
      }

      if (!resp.ok) {
        throw new Error(json?.message || "Failed to fetch rates")
      }

      setRateId(json.rate_id)
      setRates(Array.isArray(json.rates) ? json.rates : [])
    } catch (e: any) {
      setError(e?.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="divide-y divide-ui-border-base p-0">
      <div className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Heading level="h2">Freightcom Rates</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Get live rates for this order and pick one to book (next step).
            </Text>
          </div>

          <Button onClick={fetchRates} isLoading={loading} disabled={!order?.id}>
            Get Rates
          </Button>
        </div>

        {rateId ? (
          <Text size="small" className="mt-3 text-ui-fg-subtle">
            Rate Request ID: {rateId}
          </Text>
        ) : null}

        {error ? (
          <Text size="small" className="mt-3 text-ui-fg-error">
            {error}
          </Text>
        ) : null}
      </div>

      <div className="p-6">
        {prettyRates.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            No rates loaded yet.
          </Text>
        ) : (
          <RadioGroup value={selected} onValueChange={setSelected}>
            <div className="flex flex-col gap-2">
              {prettyRates.map((r) => (
                <RadioGroup.Item key={r.key} value={r.key}>
                  {r.label}
                </RadioGroup.Item>
              ))}
            </div>
          </RadioGroup>
        )}

        {/* Next step (booking) will be enabled once we build the book route */}
        <div className="mt-4">
          <Button disabled={!selected} variant="secondary">
            Book Shipment (next)
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  // Good default zone for order page (you can switch to side/before/after later)
  zone: "order.details.after",
})
