import { useMutation, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Clock, DollarSign, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useNotificationSound } from "@/hooks/use-notification-sound"
import { useWebSocket } from "@/hooks/use-websocket"
import { queryClient, trpc, trpcClient } from "@/utils/trpc"

import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

/**
 * T090: ServingQueue Component
 * Displays orders ready to be served and already served
 *
 * Acceptance: spec.md US4 Scenario 3
 * - Orders displayed with wait time information
 * - Priority sorting (longest waiting first)
 *
 * T091: WebSocket connection for real-time Ready to Serve notifications
 * WebSocket Integration: research.md Section 6
 * - Listens for ORDER_READY events from kitchen
 *
 * T092: Status transition actions
 * Contract: orders-router.md updateStatus
 * - Mark as Served
 * - Mark as Completed
 *
 * T093: Display full order status history
 * Data Model: data-model.md OrderStatusHistory
 * - Shows complete status transitions with timestamps
 *
 * T094: Priority sorting
 * Business Logic: orders-router.md Procedure 9
 * - Sorts by waitTime DESC (oldest orders first)
 */

interface OrderItem {
  dishName: string
  quantity: number
}

interface ServingOrder {
  id: number
  tableNumber: number
  status: "ReadyToServe" | "Served"
  items: OrderItem[]
  totalAmount: number
  readySince: string | null // Changed from Date to string to match API response
  waitTime: number // in minutes
}

interface ServingQueueProps {
  orders: ServingOrder[]
  onRefresh: () => void
}

export function ServingQueue({ orders, onRefresh }: ServingQueueProps) {
  const { t } = useTranslation()
  const [isConnected, setIsConnected] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null)
  const { playSound } = useNotificationSound()

  // Mutation for updating order status
  const updateStatusMutation = useMutation({
    mutationFn: (variables: { orderId: number; newStatus: "Served" | "Completed" }) =>
      trpcClient.orders.updateStatus.mutate(variables),
    onSuccess: () => {
      // Invalidate queries to refetch serving orders
      queryClient.invalidateQueries({
        predicate: (query) => {
          // tRPC query keys are arrays like [["orders", "getServingOrders"], {...input}]
          const queryKey = query.queryKey[0]
          return (
            Array.isArray(queryKey) &&
            queryKey[0] === "orders" &&
            queryKey[1] === "getServingOrders"
          )
        },
      })
      toast.success(t("serving.orderCard.statusUpdated"))
    },
    onError: (error: Error) => {
      toast.error(t("serving.orderCard.updateFailed"), {
        description: error.message,
      })
    },
  })

  // Query for detailed order information when expanded
  const { data: orderDetails } = useQuery({
    ...trpc.orders.getById.queryOptions({ orderId: expandedOrderId! }),
    enabled: expandedOrderId !== null,
  })

  /**
   * T091: WebSocket integration for real-time updates
   *
   * Connects to WebSocket server with 'serving' role
   * Listens for ORDER_READY events when kitchen marks orders ready
   * Automatically invalidates queries and shows notifications
   */
  const handleWebSocketMessage = useCallback(
    (message: { type: string; [key: string]: unknown }) => {
      console.log("[ServingQueue] WebSocket message:", message)

      switch (message.type) {
        case "ORDER_READY":
          // Invalidate queries to refetch serving orders
          console.log("[ServingQueue] Invalidating serving orders query for ORDER_READY")
          queryClient.invalidateQueries({
            predicate: (query) => {
              // tRPC query keys are arrays like [["orders", "getServingOrders"], {...input}]
              const queryKey = query.queryKey[0]
              const match =
                Array.isArray(queryKey) &&
                queryKey[0] === "orders" &&
                queryKey[1] === "getServingOrders"
              console.log("[ServingQueue] Checking query:", queryKey, "Match:", match)
              return match
            },
          })

          // Play notification sound when order is ready to serve
          console.log("[ServingQueue] Order ready for serving, playing notification sound")
          playSound()

          // Show notification
          const order = message.order as { id?: number; tableNumber?: number }
          if (order?.tableNumber) {
            toast.info(`Order ready for Table ${order.tableNumber}`, {
              description: `Order #${order.id} is ready to serve`,
            })
          }
          break

        case "ORDER_STATUS_CHANGED":
          // Invalidate queries to refetch serving orders
          console.log("[ServingQueue] Invalidating serving orders query for ORDER_STATUS_CHANGED")
          queryClient.invalidateQueries({
            predicate: (query) => {
              // tRPC query keys are arrays like [["orders", "getServingOrders"], {...input}]
              const queryKey = query.queryKey[0]
              const match =
                Array.isArray(queryKey) &&
                queryKey[0] === "orders" &&
                queryKey[1] === "getServingOrders"
              console.log("[ServingQueue] Checking query:", queryKey, "Match:", match)
              return match
            },
          })
          break

        default:
          // Ignore other message types
          break
      }
    },
    [playSound]
  )

  // Connect to WebSocket with 'serving' role
  useWebSocket({
    role: "serving",
    onMessage: handleWebSocketMessage,
    onConnect: () => {
      console.log("[ServingQueue] WebSocket connected")
      setIsConnected(true)
    },
    onDisconnect: () => {
      console.log("[ServingQueue] WebSocket disconnected")
      setIsConnected(false)
    },
  })

  // T092: Handle status transitions
  const handleMarkAsServed = (orderId: number) => {
    updateStatusMutation.mutate({ orderId, newStatus: "Served" })
  }

  const handleMarkAsCompleted = (orderId: number) => {
    updateStatusMutation.mutate({ orderId, newStatus: "Completed" })
  }

  // T093: Toggle order details to show status history
  const handleToggleDetails = (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null)
    } else {
      setExpandedOrderId(orderId)
      // The query will automatically refetch when enabled
    }
  }

  // Separate orders by status
  const readyOrders = orders.filter((o) => o.status === "ReadyToServe")
  const servedOrders = orders.filter((o) => o.status === "Served")

  return (
    <div className="space-y-4">
      {/* Header with WebSocket status and refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {readyOrders.length} {t("serving.servingQueue.ready")} • {servedOrders.length} {t("serving.servingQueue.served")}
          </p>
          <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                {t("serving.servingQueue.live")}
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                {t("serving.servingQueue.offline")}
              </>
            )}
          </Badge>
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("serving.servingQueue.refresh")}
        </Button>
      </div>

      {/* Ready to Serve Section */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          {t("serving.servingQueue.readySection.title")}
          <Badge variant="default">{readyOrders.length}</Badge>
        </h2>

        {readyOrders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t("serving.servingQueue.readySection.noOrders")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {readyOrders.map((order) => (
              <Card
                key={order.id}
                className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {t("serving.orderCard.table", { number: order.tableNumber })}
                        <Badge variant="default" className="bg-green-600">
                          {t("serving.orderCard.ready")}
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className={order.waitTime > 10 ? "text-red-600 font-semibold" : ""}>
                          {t("serving.orderCard.waiting", { minutes: order.waitTime })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        ${(order.totalAmount / 100).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">{t("serving.orderCard.orderId", { id: order.id })}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Order Items */}
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>
                          {item.quantity}x {item.dishName}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleMarkAsServed(order.id)}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1"
                      variant="default"
                    >
                      {t("serving.orderCard.markAsServed")}
                    </Button>
                    <Button
                      onClick={() => handleToggleDetails(order.id)}
                      variant="outline"
                      size="sm"
                    >
                      {expandedOrderId === order.id ? t("serving.orderCard.hideDetails") : t("serving.orderCard.viewDetails")}
                    </Button>
                  </div>

                  {/* T093: Status History */}
                  {expandedOrderId === order.id && orderDetails && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <h4 className="font-semibold text-sm">{t("serving.orderCard.statusHistory")}</h4>
                      <div className="space-y-2">
                        {orderDetails.statusHistory.map((entry: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <Badge variant="outline" className="text-xs">
                              {entry.status}
                            </Badge>
                            <span>{new Date(entry.changedAt).toLocaleString()}</span>
                            <span className="text-xs">by {entry.changedBy}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Served Section */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          {t("serving.servingQueue.servedSection.title")}
          <Badge variant="secondary">{servedOrders.length}</Badge>
        </h2>

        {servedOrders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t("serving.servingQueue.servedSection.noOrders")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {servedOrders.map((order) => (
              <Card key={order.id} className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {t("serving.orderCard.table", { number: order.tableNumber })}
                        <Badge variant="secondary" className="bg-blue-600 text-white">
                          {t("serving.orderCard.served")}
                        </Badge>
                      </CardTitle>
                      <div className="text-xs text-muted-foreground">{t("serving.orderCard.orderId", { id: order.id })}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        ${(order.totalAmount / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Order Items */}
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>
                          {item.quantity}x {item.dishName}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleMarkAsCompleted(order.id)}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1"
                      variant="default"
                    >
                      {t("serving.orderCard.markAsCompleted")}
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/payment" search={{ orderId: order.id }}>
                        <DollarSign className="mr-2 h-4 w-4" />
                        {t("serving.orderCard.processPayment")}
                      </Link>
                    </Button>
                    <Button
                      onClick={() => handleToggleDetails(order.id)}
                      variant="outline"
                      size="sm"
                    >
                      {expandedOrderId === order.id ? t("serving.orderCard.hideDetails") : t("serving.orderCard.viewDetails")}
                    </Button>
                  </div>

                  {/* T093: Status History */}
                  {expandedOrderId === order.id && orderDetails && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <h4 className="font-semibold text-sm">{t("serving.orderCard.statusHistory")}</h4>
                      <div className="space-y-2">
                        {orderDetails.statusHistory.map((entry: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <Badge variant="outline" className="text-xs">
                              {entry.status}
                            </Badge>
                            <span>{new Date(entry.changedAt).toLocaleString()}</span>
                            <span className="text-xs">by {entry.changedBy}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {orders.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground mb-2">{t("serving.servingQueue.noOrders")}</p>
            <p className="text-sm text-muted-foreground">
              {t("serving.servingQueue.noOrdersMessage")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
