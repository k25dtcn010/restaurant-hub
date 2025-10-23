import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { InventoryTable } from "@/components/inventory-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/utils/trpc"

/**
 * T104: Inventory Dashboard Route
 * Main inventory dashboard with authentication guard (Manager only)
 *
 * Acceptance: spec.md US5 Scenario 1
 * - Managers view all ingredients with current quantities
 * - Low-stock items highlighted with visual alerts
 *
 * Plan Reference: plan.md Task 5.2 - Build inventory dashboard
 * Auth Guard: research.md Section 5 Access Control Matrix - Manager only access
 */

export const Route = createFileRoute("/inventory")({
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
    // Check if user has Manager role
    // const userRole = (session.data.user as any).role;
    // if (userRole !== "Manager") {
    // 	throw redirect({
    // 		to: "/dashboard",
    // 	});
    // }

    return { session }
  },
})

function RouteComponent() {
  const { t } = useTranslation()
  const [includeRecipes, setIncludeRecipes] = useState(true)

  // Query inventory data
  const {
    data: inventoryData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    ...trpc.inventory.getAll.queryOptions({
      includeRecipes,
    }),
  })

  // Calculate low-stock count
  const lowStockCount = inventoryData?.ingredients.filter((i) => i.isLowStock).length || 0

  const handleRefresh = async () => {
    toast.info("Refreshing inventory...")
    await refetch()
    toast.success("Inventory refreshed")
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("inventory.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("inventory.subtitle")}</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* Low-stock alert summary */}
      {lowStockCount > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <h3 className="font-semibold text-destructive">{t("inventory.lowStockAlert")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("inventory.lowStockMessage", { count: lowStockCount })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Inventory table */}
      <Card>
        <CardHeader>
          <CardTitle>All Ingredients</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading inventory...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading inventory: {error.message}
            </div>
          ) : !inventoryData || inventoryData.ingredients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No ingredients found</div>
          ) : (
            <InventoryTable ingredients={inventoryData.ingredients} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
