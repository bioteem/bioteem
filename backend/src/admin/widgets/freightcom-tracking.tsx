import { useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Text, Badge } from "@medusajs/ui"
import { useMutation } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

type TrackingEvent = {
  type?: string
  when?: string
  where?: { city?: string; region?: string; country?: string }
  message?: string
}

type TrackingEventsResp = { events?: TrackingEvent[] }

function getOrderFromWidgetData(data: any) {
  return data?.order ?? data?.resource ?? data ?? null
}

export default function FreightcomTrackingUpdatesWidget({ data }: any) {
  const order = getOrderFromWidgetData(data)
  const orderId = order?.id
  const shipmentId = order?.metadata?.freightcom_shipment_id as string | undefined
  const [events, setEvents] = useState<TrackingEvent[]>([])

  const fetchEvents = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Missing orderId")
      if (!shipmentId) throw new Error("No Freightcom shipment on this order yet.")
      return sdk.client.fetch<TrackingEventsResp>(
        `/admin/orders/${orderId}/freightcom/shipments/${shipmentId}/tracking-events`
      )
    },
    onSuccess: (resp) => setEvents(resp?.events || []),
  })

  useEffect(() => {
    if (!orderId || !shipmentId) return
    fetchEvents.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, shipmentId])

  const statusBadge = useMemo(() => {
    if (!shipmentId) return <Badge size="small" color="grey">No shipment</Badge>
    if (fetchEvents.isPending) return <Badge size="small" color="orange">Loading</Badge>
    return <Badge size="small" color="green">Ready</Badge>
  }, [shipmentId, fetchEvents.isPending])

  return (
    <Container className="p-0">
      <div className="flex items-start justify-between px-6 py-4 gap-4">
        <div className="min-w-0">
          <Heading level="h2">Freightcom Tracking Updates</Heading>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {statusBadge}
            {shipmentId ? (
              <Text size="small" className="text-ui-fg-subtle break-all">Shipment: {shipmentId}</Text>
            ) : null}
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={() => fetchEvents.mutate()}
          disabled={!shipmentId || fetchEvents.isPending}
        >
          {fetchEvents.isPending ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="px-6 pb-6">
        {fetchEvents.isError && (
          <Text size="small" className="text-ui-fg-error">
            {String((fetchEvents.error as any)?.message || "Error")}
          </Text>
        )}

        {!shipmentId ? (
          <Text size="small" className="text-ui-fg-subtle">
            No Freightcom shipment has been booked for this order yet.
          </Text>
        ) : events.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            No tracking events yet.
          </Text>
        ) : (
          <div className="space-y-2">
            {events.map((e, idx) => (
              <div key={idx} className="rounded-md border border-ui-border-base p-3">
                <Text className="font-medium">{e.type || "event"}</Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {e.when || "—"} • {(e.where?.city || "—")}, {(e.where?.region || "—")} {(e.where?.country || "")}
                </Text>
                {e.message ? <Text size="small" className="mt-1">{e.message}</Text> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})