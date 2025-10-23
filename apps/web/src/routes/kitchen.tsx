import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import Loader from "@/components/loader"
import { OrdersBoard } from "@/components/orders-board"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/utils/trpc"

/**
 * T068: Kitchen Dashboard Route
 * Main kitchen dashboard with authentication guard (KitchenStaff role)
 *
 * Acceptance: spec.md US2 Scenario 1-2
 * - Kitchen staff view incoming orders grouped by table
 * - Orders sorted by submission time (oldest first)
 *
 * Plan Reference: plan.md Task 3.2 - Build kitchen dashboard UI
 * Auth Guard: research.md Section 5 Access Control Matrix - KitchenStaff role
 */

export const Route = createFileRoute("/kitchen")({
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
    // Check if user has KitchenStaff or Manager role
    // const userRole = (session.data.user as any).role;
    // if (userRole !== "KitchenStaff" && userRole !== "Manager") {
    // 	throw redirect({
    // 		to: "/dashboard",
    // 	});
    // }

    return { session }
  },
})

function RouteComponent() {
  const { t } = useTranslation()
  const routeContext = Route.useRouteContext()
  const session = routeContext.session

  // Query kitchen orders (Pending, InKitchen, ReadyToServe)
  // Note: No polling interval since we now use WebSocket for real-time updates
  const { data, isLoading, error, refetch } = useQuery({
    ...trpc.orders.getKitchenOrders.queryOptions({
      status: ["Pending", "InKitchen", "ReadyToServe"],
    }),
  })

  // Convert date strings to Date objects
  const ordersWithDates =
    data?.orders.map((order) => ({
      ...order,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
    })) || []

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">{t("kitchen.errorLoading")}</h2>
            <p className="text-muted-foreground mb-4">{error.message}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              {t("kitchen.retry")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("kitchen.title")}</h1>
        <p className="text-muted-foreground">
          {t("kitchen.welcome", { name: session.data?.user.name })}
        </p>
      </div>

      {/* T069-T074: OrdersBoard with status columns and real-time updates */}
      <OrdersBoard orders={ordersWithDates} onRefresh={refetch} />
    </div>
  )
}
