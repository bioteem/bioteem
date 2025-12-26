import { useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Text, Badge } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
  const fallbackOrder = getOrderFromWidgetData(data)
  const orderId = fallbackOrder?.id
  const qc = useQueryClient()

  // ✅ Always use fresh order so shipment id is never stale
  const orderQuery = useQuery({
    queryKey: ["admin-order", orderId],
    enabled: !!orderId,
    queryFn: async () => sdk.client.fetch<any>(`/admin/orders/${orderId}`),
    staleTime: 5_000,
  })

  const liveOrder = orderQuery.data?.order ?? fallbackOrder
  const shipmentId = (liveOrder?.metadata?.freightcom_shipment_id as string | undefined) ?? null

  const [events, setEvents] = useState<TrackingEvent[]>([])

  const fetchEvents = useMutation({
    mutationFn: async (vars: { shipmentId: string }) => {
      if (!orderId) throw new Error("Missing orderId")
      if (!vars.shipmentId) throw new Error("No Freightcom shipment on this order yet.")
      return sdk.client.fetch<TrackingEventsResp>(
        `/admin/orders/${orderId}/freightcom/shipments/${vars.shipmentId}/tracking-events`
      )
    },
    onSuccess: (resp) => setEvents(resp?.events || []),
  })

  // ✅ Auto-load when shipment id exists/changes
  useEffect(() => {
    if (!orderId || !shipmentId) return
    fetchEvents.mutate({ shipmentId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, shipmentId])

  const statusBadge = useMemo(() => {
    if (!shipmentId) return <Badge size="small" color="grey">No shipment</Badge>
    if (fetchEvents.isPending || orderQuery.isPending) return <Badge size="small" color="orange">Loading</Badge>
    return <Badge size="small" color="green">Ready</Badge>
  }, [shipmentId, fetchEvents.isPending, orderQuery.isPending])

  const onRefresh = async () => {
    if (!orderId) return
    // ✅ force fresh metadata FIRST, then use the newest shipment id
    const fresh = await qc.fetchQuery({
      queryKey: ["admin-order", orderId],
      queryFn: async () => sdk.client.fetch<any>(`/admin/orders/${orderId}`),
    })
    const freshShipmentId =
      (fresh?.order?.metadata?.freightcom_shipment_id as string | undefined) ?? null

    if (!freshShipmentId) {
      setEvents([])
      return
    }

    fetchEvents.mutate({ shipmentId: freshShipmentId })
  }

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
          onClick={onRefresh}
          disabled={!orderId || !shipmentId || fetchEvents.isPending || orderQuery.isPending}
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