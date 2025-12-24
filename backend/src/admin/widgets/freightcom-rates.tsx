import { useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, RadioGroup, Text } from "@medusajs/ui"

type Rate = Record<string, any>

export default function FreightcomRatesWidget(props: any) {
  // ✅ Try multiple shapes (dashboard differs by zone/version)
  const order =
    props?.data?.order ??
    props?.order ??
    (props?.data?.id ? props.data : null) ??
    props?.data?.resource ??
    null

  const orderId = order?.id

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rates, setRates] = useState<Rate[]>([])
  const [rateId, setRateId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>("")

  const prettyRates = useMemo(() => {
    return (rates || []).map((r, idx) => {
      const key = String(r.id ?? r.rate_id ?? r.service_id ?? idx)
      const label =
        `${r.carrier_name ?? r.carrier ?? "Carrier"} • ` +
        `${r.service_name ?? r.service ?? "Service"} • ` +
        `${r.total_price ?? r.total ?? r.price ?? "?"} ${r.currency ?? ""}`

      return { key, label }
    })
  }, [rates])

  const fetchRates = async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)

    try {
      const resp = await fetch(`/admin/orders/${orderId}/freightcom/rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })

      const json = await resp.json()

      if (resp.status === 202) {
        setRateId(json.rate_id)
        setError("Rates still processing — click Get Rates again in a moment.")
        setRates([])
        return
      }

      if (!resp.ok) throw new Error(json?.message || "Failed to fetch rates")

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

            {/* ✅ Debug line so we can see if the widget has the order */}
            <Text size="small" className="mt-2 text-ui-fg-subtle">
              Debug: orderId = {orderId || "(missing)"}{" "}
            </Text>
          </div>

          <Button onClick={fetchRates} isLoading={loading} disabled={!orderId}>
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
                <div key={r.key} className="flex items-center gap-2">
                  <RadioGroup.Item value={r.key} />
                  <label className="text-sm cursor-pointer">{r.label}</label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )}

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
  zone: "order.details.after",
})
