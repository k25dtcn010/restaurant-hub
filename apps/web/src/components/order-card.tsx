import { useMutation } from "@tanstack/react-query"
import { CheckCircle2, ChefHat, Clock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { queryClient, trpc, trpcClient } from "@/utils/trpc"

/**
 * T070: OrderCard Component
 * Displays individual order with table, dishes, quantities, timestamps
 *
 * Acceptance: spec.md US2 Scenario 1
 * - Shows table number, dishes, quantities
 * - Displays timestamp for order tracking
 *
 * T072: Status transition buttons
 * Acceptance: spec.md US2 Scenario 3-4
 * - Kitchen staff can mark orders as "In Kitchen" or "Ready to Serve"
 * - Status updates are reflected in real-time
 *
 * T073: Visual distinction between statuses with color coding
 * Acceptance: spec.md US2 Scenario 5
 * - Clear visual distinction between Pending, In Kitchen, and Ready to Serve
 *
 * T080: Display variant name in kitchen order card
 * Format: "Coffee (Medium) x2" instead of just "Coffee x2"
 */

interface OrderItemModifier {
  name: string
  priceAtOrder: number
}

interface OrderItem {
  dishName: string
  variantName?: string | null // T080: Variant name (e.g., "Large", "Medium")
  quantity: number
  specialInstructions: string | null
  modifiers?: OrderItemModifier[] // T044: Add modifiers
  specialRequest?: string // T045: Explicitly named special request field
}

interface Order {
  id: number
  tableNumber: number
  status: "Pending" | "InKitchen" | "ReadyToServe"
  items: OrderItem[]
  createdAt: Date
  updatedAt: Date
  waitTime: number // in minutes
}

interface OrderCardProps {
  order: Order
  onStatusUpdate?: () => void
}

// Status badge styling based on status
const statusStyles = {
  Pending: {
    variant: "secondary" as const,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  InKitchen: {
    variant: "default" as const,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  ReadyToServe: {
    variant: "default" as const,
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
}

// Card border styling based on status (T073)
const cardBorderStyles = {
  Pending: "border-l-4 border-l-yellow-500",
  InKitchen: "border-l-4 border-l-blue-500",
  ReadyToServe: "border-l-4 border-l-green-500",
}

export function OrderCard({ order, onStatusUpdate }: OrderCardProps) {
  const { t } = useTranslation()
  // Mutation for updating order status
  const updateStatusMutation = useMutation({
    mutationFn: (variables: {
      orderId: number
      newStatus: "InKitchen" | "ReadyToServe" | "Served" | "Completed" | "Paid"
    }) => trpcClient.orders.updateStatus.mutate(variables),
    onSuccess: () => {
      // Invalidate and refetch kitchen orders
      queryClient.invalidateQueries({
        predicate: (query) => {
          // tRPC query keys are arrays like [["orders", "getKitchenOrders"], {...input}]
          const queryKey = query.queryKey[0]
          return (
            Array.isArray(queryKey) &&
            queryKey[0] === "orders" &&
            queryKey[1] === "getKitchenOrders"
          )
        },
      })
      toast.success(`Order #${order.id} status updated`)
      onStatusUpdate?.()
    },
    onError: (error: Error) => {
      toast.error(t("kitchen.orderCard.updateFailed", { error: error.message }))
    },
  })

  // Determine next status based on current status
  const getNextStatus = (): "InKitchen" | "ReadyToServe" | null => {
    if (order.status === "Pending") return "InKitchen"
    if (order.status === "InKitchen") return "ReadyToServe"
    return null
  }

  const handleStatusUpdate = () => {
    const nextStatus = getNextStatus()
    if (!nextStatus) return

    updateStatusMutation.mutate({
      orderId: order.id,
      newStatus: nextStatus,
    })
  }

  const nextStatus = getNextStatus()
  const statusStyle = statusStyles[order.status]
  const borderStyle = cardBorderStyles[order.status]

  // Format timestamp
  const formatTime = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Get status button label and icon
  const getStatusButton = () => {
    if (order.status === "Pending") {
      return {
        label: t("kitchen.orderCard.startCooking"),
        icon: <ChefHat className="mr-2 h-4 w-4" />,
      }
    }
    if (order.status === "InKitchen") {
      return {
        label: t("kitchen.orderCard.markReady"),
        icon: <CheckCircle2 className="mr-2 h-4 w-4" />,
      }
    }
    return null
  }

  const statusButton = getStatusButton()

  return (
    <Card className={`transition-all hover:shadow-md ${borderStyle}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">{t("kitchen.orderCard.table", { number: order.tableNumber })}</CardTitle>
          <Badge className={statusStyle.className}>
            {order.status === "InKitchen"
              ? t("kitchen.orderCard.inKitchen")
              : order.status === "ReadyToServe"
                ? t("kitchen.orderCard.readyToServe")
                : t("kitchen.orderCard.pending")}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{formatTime(order.createdAt)}</span>
          </div>
          <span className={order.waitTime > 15 ? "text-orange-600 font-semibold" : ""}>
            {t("kitchen.orderCard.timeAgo", { minutes: order.waitTime })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Items */}
        <div className="space-y-2">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{item.quantity}x</span>
                  {/* T080: Display variant name if present */}
                  <span>
                    {item.dishName}
                    {item.variantName && (
                      <span className="text-muted-foreground"> ({item.variantName})</span>
                    )}
                  </span>
                </div>
                {/* T044: Display modifiers */}
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="ml-8 mt-1 space-y-0.5">
                    {item.modifiers.map((modifier, modIndex) => (
                      <div key={modIndex} className="text-sm text-muted-foreground">
                        <span className="mr-2">{t("kitchen.orderCard.modifierPlus")}</span>
                        <span>{modifier.name}</span>
                        {modifier.priceAtOrder !== 0 && (
                          <span className="ml-2">
                            ({modifier.priceAtOrder > 0 ? "+" : ""}$
                            {(modifier.priceAtOrder / 100).toFixed(2)})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* T045: Display special request with distinct styling */}
                {(item.specialRequest || item.specialInstructions) && (
                  <div className="ml-8 mt-2 flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950 border-l-2 border-amber-500 rounded">
                    <span className="text-lg">📝</span>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200 italic">
                      {item.specialRequest || item.specialInstructions}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Status Update Button (T072) */}
        {statusButton && nextStatus && (
          <Button
            onClick={handleStatusUpdate}
            disabled={updateStatusMutation.isPending}
            className="w-full"
            variant={order.status === "Pending" ? "default" : "default"}
          >
            {updateStatusMutation.isPending ? (
              <>{t("kitchen.orderCard.loading")}</>
            ) : (
              <>
                {statusButton.icon}
                {statusButton.label}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
