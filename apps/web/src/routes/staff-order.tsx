import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { TRPCClientError } from "@trpc/client"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { MenuListColumn } from "@/components/menu-list-column"
import { OrderCartColumn } from "@/components/order-cart-column"
import { TableSelectorColumn } from "@/components/table-selector-column"
import { Card, CardContent } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import { queryClient, trpc, trpcClient } from "@/utils/trpc"

/**
 * T080: Staff-Order Route
 * Route for staff to create orders on behalf of customers
 *
 * Acceptance: spec.md US3 Scenarios 1-2
 * - Waiter/Manager can select a table
 * - Browse menu and add dishes to order
 * - Submit order with same workflow as QR orders
 *
 * Auth Guard: research.md Section 5 Access Control Matrix - Waiter or Manager access
 * Plan Reference: plan.md Task 4.1 - Build staff order creation UI
 *
 * T088: Extended to allow staff to add hidden dishes with confirmation
 *
 * Updated with 3-column layout:
 * - Left: Table selection with search
 * - Center: Menu items with search (Radio Card style)
 * - Right: Order cart
 */

export const Route = createFileRoute("/staff-order")({
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

interface CartItem {
  dishId: number
  dishName: string
  quantity: number
  priceAtOrder: number
}

function RouteComponent() {
  const routeContext = Route.useRouteContext()
  const session = routeContext.session

  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [cart, setCart] = useState<Map<number, CartItem>>(new Map())

  // Fetch all tables
  const { data: tablesData, isLoading: tablesLoading } = useQuery(trpc.tables.getAll.queryOptions())

  // T088: Fetch dishes - include hidden dishes for staff to manually add if needed (e.g., phone orders)
  const { data: dishesData, isLoading: dishesLoading } = useQuery(
    trpc.dishes.getAll.queryOptions({
      includeDisabled: false,
      includeHidden: true,
    })
  )

  // Order creation mutation
  const createOrderMutation = useMutation({
    mutationFn: (variables: {
      tableId: number
      items: Array<{ dishId: number; quantity: number }>
    }) => trpcClient.orders.create.mutate(variables),
  })

  const submitOrderMutation = useMutation({
    mutationFn: (variables: { orderId: number }) => trpcClient.orders.submit.mutate(variables),
  })

  const tables = tablesData?.tables || []
  const dishes = dishesData?.dishes || []

  const selectedTable = tables.find((t) => t.id === selectedTableId)

  // Handle table selection
  const handleSelectTable = (tableId: number) => {
    setSelectedTableId(tableId)
  }

  // Handle adding/removing items from cart
  const handleAddToCart = (dishId: number, quantity: number) => {
    if (quantity === 0) {
      // Remove from cart
      setCart((prev) => {
        const newCart = new Map(prev)
        newCart.delete(dishId)
        return newCart
      })
      return
    }

    const dish = dishes.find((d: { id: number; name: string; price: number }) => d.id === dishId)
    if (!dish) return

    setCart((prev) => {
      const newCart = new Map(prev)
      newCart.set(dishId, {
        dishId,
        dishName: dish.name,
        quantity,
        priceAtOrder: dish.price,
      })
      return newCart
    })
  }

  const handleRemoveItem = (dishId: number) => {
    handleAddToCart(dishId, 0)
  }

  // Handle order submission
  const handleSubmitOrder = async () => {
    if (!selectedTableId) {
      toast.error("Please select a table first.")
      return
    }

    if (cart.size === 0) {
      toast.error("Cart is empty. Add items before submitting.")
      return
    }

    try {
      // Create order
      const items = Array.from(cart.values()).map((item) => ({
        dishId: item.dishId,
        quantity: item.quantity,
      }))

      const createResult = await createOrderMutation.mutateAsync({
        tableId: selectedTableId,
        items,
      })

      // Submit order to kitchen
      await submitOrderMutation.mutateAsync({
        orderId: createResult.orderId,
      })

      // Success!
      toast.success(
        createResult.isNew ? "Order submitted to kitchen!" : "Items added to existing order!"
      )

      // Clear cart but keep table selected for next order
      setCart(new Map())

      // Invalidate tables query to update active order status
      queryClient.invalidateQueries({
        queryKey: trpc.tables.getAll.queryKey(),
      })

      // Invalidate kitchen orders query so kitchen page shows the new order
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
    } catch (error) {
      // Handle errors
      if (error instanceof TRPCClientError) {
        toast.error(error.message)
      } else {
        toast.error("Failed to submit order. Please try again.")
      }
      console.error("Order submission error:", error)
    }
  }

  const cartItems = Array.from(cart.values())
  const cartQuantities = useMemo(() => {
    const map = new Map<number, number>()
    cart.forEach((item, dishId) => {
      map.set(dishId, item.quantity)
    })
    return map
  }, [cart])

  const isLoading = tablesLoading || dishesLoading

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 bg-card shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Staff Order Creation</h1>
        <p className="text-sm text-muted-foreground">Create orders on behalf of customers</p>
      </div>

      {/* 3-Column Layout - 1:3:1 ratio */}
      <div className="flex-1 grid grid-cols-5 gap-4 p-4 min-h-0 overflow-hidden">
        {/* Left Column: Table Selection (1 part) */}
        <div className="col-span-1 min-h-0">
          <TableSelectorColumn
            tables={tables}
            isLoading={tablesLoading}
            selectedTableId={selectedTableId}
            onSelectTable={handleSelectTable}
          />
        </div>

        {/* Center Column: Menu Items (3 parts) */}
        <div className="col-span-3 min-h-0">
          {selectedTableId ? (
            <MenuListColumn
              dishes={dishes as any}
              isLoading={dishesLoading}
              onAddToCart={handleAddToCart}
              cartItems={cartQuantities}
              requireHiddenConfirmation={true}
            />
          ) : (
            <Card className="h-full flex flex-col">
              <CardContent className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <p className="font-medium mb-2">Select a table to browse menu</p>
                  <p className="text-sm">Choose a table from the left to get started</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Order Cart (1 part) */}
        <div className="col-span-1 min-h-0">
          {selectedTableId ? (
            <OrderCartColumn
              items={cartItems}
              tableNumber={selectedTable?.number}
              isLoading={isLoading}
              onRemoveItem={handleRemoveItem}
              onSubmit={handleSubmitOrder}
              isSubmitting={createOrderMutation.isPending || submitOrderMutation.isPending}
            />
          ) : (
            <Card className="h-full flex flex-col">
              <CardContent className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <p className="font-medium mb-2">Your Order</p>
                  <p className="text-sm">Cart will appear here once a table is selected</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
