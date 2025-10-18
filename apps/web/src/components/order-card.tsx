import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ChefHat, CheckCircle2 } from "lucide-react";
import { trpc, trpcClient, queryClient } from "@/utils/trpc";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

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
 */

interface OrderItem {
  dishName: string;
  quantity: number;
  specialInstructions: string | null;
}

interface Order {
  id: number;
  tableNumber: number;
  status: "Pending" | "InKitchen" | "ReadyToServe";
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
  waitTime: number; // in minutes
}

interface OrderCardProps {
  order: Order;
  onStatusUpdate?: () => void;
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
};

// Card border styling based on status (T073)
const cardBorderStyles = {
  Pending: "border-l-4 border-l-yellow-500",
  InKitchen: "border-l-4 border-l-blue-500",
  ReadyToServe: "border-l-4 border-l-green-500",
};

export function OrderCard({ order, onStatusUpdate }: OrderCardProps) {
  // Mutation for updating order status
  const updateStatusMutation = useMutation({
    mutationFn: (variables: {
      orderId: number;
      newStatus: "InKitchen" | "ReadyToServe" | "Served" | "Completed" | "Paid";
    }) => trpcClient.orders.updateStatus.mutate(variables),
    onSuccess: () => {
      // Invalidate and refetch kitchen orders
      queryClient.invalidateQueries({
        predicate: (query) => {
          // tRPC query keys are arrays like [["orders", "getKitchenOrders"], {...input}]
          const queryKey = query.queryKey[0];
          return (
            Array.isArray(queryKey) &&
            queryKey[0] === "orders" &&
            queryKey[1] === "getKitchenOrders"
          );
        },
      });
      toast.success(`Order #${order.id} status updated`);
      onStatusUpdate?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update order: ${error.message}`);
    },
  });

  // Determine next status based on current status
  const getNextStatus = (): "InKitchen" | "ReadyToServe" | null => {
    if (order.status === "Pending") return "InKitchen";
    if (order.status === "InKitchen") return "ReadyToServe";
    return null;
  };

  const handleStatusUpdate = () => {
    const nextStatus = getNextStatus();
    if (!nextStatus) return;

    updateStatusMutation.mutate({
      orderId: order.id,
      newStatus: nextStatus,
    });
  };

  const nextStatus = getNextStatus();
  const statusStyle = statusStyles[order.status];
  const borderStyle = cardBorderStyles[order.status];

  // Format timestamp
  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status button label and icon
  const getStatusButton = () => {
    if (order.status === "Pending") {
      return {
        label: "Start Cooking",
        icon: <ChefHat className="mr-2 h-4 w-4" />,
      };
    }
    if (order.status === "InKitchen") {
      return {
        label: "Mark Ready",
        icon: <CheckCircle2 className="mr-2 h-4 w-4" />,
      };
    }
    return null;
  };

  const statusButton = getStatusButton();

  return (
    <Card className={`transition-all hover:shadow-md ${borderStyle}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">Table {order.tableNumber}</CardTitle>
          <Badge className={statusStyle.className}>
            {order.status === "InKitchen"
              ? "In Kitchen"
              : order.status === "ReadyToServe"
                ? "Ready to Serve"
                : order.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{formatTime(order.createdAt)}</span>
          </div>
          <span className={order.waitTime > 15 ? "text-orange-600 font-semibold" : ""}>
            {order.waitTime} min ago
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
                  <span>{item.dishName}</span>
                </div>
                {item.specialInstructions && (
                  <p className="text-sm text-muted-foreground italic ml-8">
                    Note: {item.specialInstructions}
                  </p>
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
              <>Loading...</>
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
  );
}
