import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import {
  ChefHat,
  Clock,
  ClipboardList,
  History,
  Package,
  TruckIcon,
  UtensilsCrossed,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/utils/trpc"

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      })
    }
    return { session }
  },
})

/**
 * T079: Dashboard Route with Role-Based Redirection
 * Central dashboard that provides navigation to different staff interfaces
 *
 * Access Control: research.md Section 5 Access Control Matrix
 * - All authenticated staff can access
 * - Shows relevant interfaces based on role
 */

function RouteComponent() {
  const { session } = Route.useRouteContext()

  const healthCheck = useQuery(trpc.healthCheck.queryOptions())

  // Note: Role checking will be enabled when user.role is available
  // For now, show all options to all authenticated users
  // const userRole = (session.data?.user as any).role;

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Staff Dashboard</h1>
        <p className="text-lg text-muted-foreground">Welcome, {session.data?.user.name}!</p>
        {healthCheck.data && (
          <p className="text-sm text-green-600 mt-2">
            API Status: {healthCheck.data.status} ({healthCheck.data.timestamp})
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Staff Order Creation */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Create Order
            </CardTitle>
            <CardDescription>Create orders on behalf of customers</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/staff-order">Go to Order Creation</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Kitchen Dashboard */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Kitchen
            </CardTitle>
            <CardDescription>View and manage incoming orders</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/kitchen">Go to Kitchen</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Serving Dashboard */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TruckIcon className="h-5 w-5" />
              Serving
            </CardTitle>
            <CardDescription>Manage orders ready to serve</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/serving">Go to Serving</Link>
            </Button>
          </CardContent>
        </Card>

        {/* T129: Shift Management Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Shifts
            </CardTitle>
            <CardDescription>Manage operational shifts and staff</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/shifts">Go to Shifts</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Inventory Management */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Inventory
            </CardTitle>
            <CardDescription>Manage ingredient stock levels</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/inventory">Go to Inventory</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Payment History - T125: Manager access only */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Payment History
            </CardTitle>
            <CardDescription>View transaction history and revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link to="/payment-history">View History</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Browse Menu */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Menu
            </CardTitle>
            <CardDescription>View restaurant menu</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/" search={{ table: undefined }}>
                View Menu
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => authClient.signOut()}>
          Sign Out
        </Button>
      </div>
    </div>
  )
}
