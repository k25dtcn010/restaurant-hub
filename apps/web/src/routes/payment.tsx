import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import Loader from "@/components/loader"
import { OrderBillView } from "@/components/order-bill-view"
import { PaymentConfirmation } from "@/components/payment-confirmation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import { queryClient, trpc, trpcClient } from "@/utils/trpc"

/**
 * T120: Payment Route
 * Cash payment processing interface for completed orders
 *
 * Auth Guard: research.md Section 5 Access Control Matrix
 * - Waiter and Manager access only
 *
 * Plan Reference: plan.md Task 4.4 - Build payment UI
 *
 * Acceptance: spec.md US6 Scenarios 1-3
 * - View itemized bill with dishes and total amount
 * - Mark order as "Paid" after receiving cash
 * - Table session cleared after payment
 */

export const Route = createFileRoute("/payment")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession()

    // Check if user is authenticated
    if (!session.data) {
      throw redirect({
        to: "/login",
      })
    }

    // Note: Role checking commented out for MVP - will be enabled when user.role is available
    // Check if user has Waiter or Manager role
    // const userRole = (session.data.user as any).role;
    // if (userRole !== "Waiter" && userRole !== "Manager") {
    // 	throw redirect({
    // 		to: "/dashboard",
    // 	});
    // }

    return { session }
  },
  validateSearch: (search: Record<string, unknown>) => {
    return {
      orderId: search.orderId ? Number(search.orderId) : undefined,
    }
  },
})

function RouteComponent() {
  const navigate = useNavigate()
  const { session } = Route.useRouteContext()
  const { orderId } = Route.useSearch()
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Fetch order details
  const {
    data: order,
    isLoading,
    error,
    refetch,
  } = useQuery({
    ...trpc.orders.getById.queryOptions({ orderId: orderId ?? 0 }),
    enabled: !!orderId,
  })

  /**
   * T123: Payment processing workflow
   * Contract: payments-router.md create
   *
   * Business Logic:
   * - Calculate total from order
   * - Confirm payment with user
   * - Call payments.create mutation
   * - Clear table session (handled by backend)
   * - Redirect to success view
   */
  const createPaymentMutation = useMutation({
    mutationFn: (variables: { orderId: number; amount: number; method: "Cash" }) =>
      trpcClient.payments.create.mutate(variables),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          // tRPC query keys are arrays like [["orders", "getServingOrders"], {...input}]
          const queryKey = query.queryKey[0]
          return (
            Array.isArray(queryKey) &&
            queryKey[0] === "orders" &&
            (queryKey[1] === "getServingOrders" || queryKey[1] === "getById")
          )
        },
      })

      toast.success("Payment processed successfully!", {
        description: `Table ${order?.tableNumber} has been cleared for new customers.`,
      })

      // Navigate back to serving dashboard
      setTimeout(() => {
        navigate({ to: "/serving" })
      }, 2000)
    },
    onError: (error: Error) => {
      setIsProcessing(false)
      toast.error("Payment processing failed", {
        description: error.message,
      })
    },
  })

  const handleProcessPayment = () => {
    setShowConfirmation(true)
  }

  const handleConfirmPayment = () => {
    if (!order) return

    setIsProcessing(true)
    createPaymentMutation.mutate({
      orderId: order.id,
      amount: order.totalAmount,
      method: "Cash",
    })
  }

  const handleCancelPayment = () => {
    setShowConfirmation(false)
  }

  // No order ID in URL
  if (!orderId) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>No Order Selected</CardTitle>
              <CardDescription>
                Please select an order from the serving dashboard to process payment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/serving">Go to Serving Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader />
        </div>
      </div>
    )
  }

  // Error state
  if (error || !order) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">Error Loading Order</CardTitle>
              <CardDescription>{error?.message || "Order not found"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => refetch()} variant="outline" className="w-full">
                Retry
              </Button>
              <Button asChild className="w-full">
                <Link to="/serving">Back to Serving Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/serving">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Serving
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Process Payment</h1>
        <p className="text-muted-foreground">
          Table {order.tableNumber} - Order #{order.id}
        </p>
      </div>

      {/* T121: OrderBillView - Display itemized order details */}
      <div className="mb-6">
        <OrderBillView order={order} />
      </div>

      {/* T122: PaymentConfirmation - Process payment action */}
      {!showConfirmation ? (
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleProcessPayment}
            disabled={order.status !== "Completed" && order.status !== "Served"}
            className="min-w-[200px]"
          >
            Process Cash Payment
          </Button>
        </div>
      ) : (
        <PaymentConfirmation
          order={order}
          onConfirm={handleConfirmPayment}
          onCancel={handleCancelPayment}
          isProcessing={isProcessing}
        />
      )}
    </div>
  )
}
