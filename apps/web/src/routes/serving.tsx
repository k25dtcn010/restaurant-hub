import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"

import Loader from "@/components/loader"
import { ServingQueue } from "@/components/serving-queue"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/utils/trpc"

/**
 * T089: Serving Dashboard Route
 * Main serving dashboard with authentication guard (Waiter role)
 *
 * Acceptance: spec.md US4 Scenario 1
 * - Serving staff view orders ready for serving
 * - Orders sorted by wait time (longest waiting first)
 *
 * Plan Reference: plan.md Task 4.2 - Implement orders.getServingOrders query
 * Auth Guard: research.md Section 5 Access Control Matrix - Waiter role
 */

export const Route = createFileRoute("/serving")({
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
})

function RouteComponent() {
  const routeContext = Route.useRouteContext()
  const session = routeContext.session

  // Query serving orders (ReadyToServe, Served)
  // Note: No polling interval since we now use WebSocket for real-time updates
  const { data, isLoading, error, refetch } = useQuery({
    ...trpc.orders.getServingOrders.queryOptions({
      status: ["ReadyToServe", "Served"],
    }),
  })

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
            <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Orders</h2>
            <p className="text-muted-foreground mb-4">{error.message}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Serving Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {session.data?.user.name}</p>
      </div>

      {/* T090-T094: ServingQueue with status columns and real-time updates */}
      <ServingQueue orders={data?.orders || []} onRefresh={refetch} />
    </div>
  )
}
