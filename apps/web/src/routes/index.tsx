import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { TRPCClientError } from "@trpc/client"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { HomeHeader } from "@/components/home-header"
import { MenuItemsSection } from "@/components/menu-items-section"
import { OrderCart } from "@/components/order-cart"
import type { CartItem, SelectedModifier } from "@/types/home-type"
import { queryClient, trpc, trpcClient } from "@/utils/trpc"

/**
 * T054: Landing page route with QR parameter handling
 * T057: Order submission flow with success/error handling
 * T059: Loading states and optimistic updates
 *
 * QR Session Logic: research.md Section 4
 * Acceptance: spec.md US1 Scenarios 1-6
 */

export const Route = createFileRoute("/")({
  component: HomeComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      table: search.table ? Number(search.table) : undefined,
    }
  },
})

function HomeComponent() {
  const { table } = Route.useSearch()
  const [cart, setCart] = useState<Map<number, CartItem>>(new Map())
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)

  // T087: Fetch dishes - exclude hidden dishes from customer view
  const { data: dishesData, isLoading: dishesLoading } = useQuery(
    trpc.dishes.getAll.queryOptions({
      includeDisabled: false,
      includeHidden: false,
    })
  )

  // Fetch table info if table ID is provided - only when table is set
  const tableQueryEnabled = !!table
  const { data: tableData, isLoading: tableLoading } = useQuery({
    ...trpc.tables.getById.queryOptions({ tableId: table || 0 }),
    enabled: tableQueryEnabled,
  })

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

  // T062: Filter dishes by category
  const allDishes = dishesData?.dishes || []

  // Filter by search query and category
  const filteredDishes = useMemo(() => {
    let items = allDishes

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query)
      )
    }

    return items
  }, [allDishes, searchQuery])

  // Group items by category (will group by dish id as default category)
  const groupedItems = useMemo(() => {
    // Group all filtered dishes under a single category
    return {
      "All Dishes": filteredDishes,
    }
  }, [filteredDishes])

  // Handle adding items to cart with modifiers and special request (T040, T042, T043)
  const handleAddToCartWithCustomization = (
    dishId: number,
    quantity: number,
    modifiers: SelectedModifier[],
    specialRequest: string
  ) => {
    if (quantity === 0) {
      // Remove from cart
      setCart((prev) => {
        const newCart = new Map(prev)
        newCart.delete(dishId)
        return newCart
      })
      return
    }

    const dish = allDishes.find((d: any) => d.id === dishId)
    if (!dish) return

    // Calculate price including modifiers (T043)
    const modifierTotal = modifiers.reduce((sum, m) => sum + (m.priceAdjustment || 0), 0)
    const totalPrice = dish.price + modifierTotal

    setCart((prev) => {
      const newCart = new Map(prev)
      newCart.set(dishId, {
        dishId,
        dishName: dish.name,
        quantity,
        priceAtOrder: totalPrice,
        modifiers,
        specialRequest,
      })
      return newCart
    })
  }

  const handleRemoveItem = (dishId: number) => {
    handleAddToCartWithCustomization(dishId, 0, [], "")
  }

  // Handle order submission
  const handleSubmitOrder = async () => {
    if (!table) {
      toast.error("No table selected. Please scan a QR code.")
      return
    }

    if (cart.size === 0) {
      toast.error("Your cart is empty. Add items before submitting.")
      return
    }

    try {
      // Create order
      const items = Array.from(cart.values()).map((item) => ({
        dishId: item.dishId,
        quantity: item.quantity,
        // T040, T042: Include modifiers and special request
        modifiers: item.modifiers?.map((m) => ({
          modifierId: m.modifierId,
          modifierGroupId: m.modifierGroupId,
        })),
        specialRequest: item.specialRequest,
      }))

      const createResult = await createOrderMutation.mutateAsync({
        tableId: table,
        items,
      })

      // Submit order to kitchen
      await submitOrderMutation.mutateAsync({
        orderId: createResult.orderId,
      })

      // Success!
      toast.success(
        createResult.isNew ? "Order submitted to kitchen!" : "Items added to your existing order!"
      )

      // Clear cart
      setCart(new Map())

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
      throw error
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

  const isLoading = dishesLoading || (tableQueryEnabled && tableLoading)
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <HomeHeader
        tableNumber={table}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartItems={cartItems}
        onOpenCartDrawer={() => setIsCartDrawerOpen(true)}
      />

      {/* Main Content - Full Width */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {/* Menu Items */}
          <MenuItemsSection
            groupedItems={groupedItems}
            selectedCategory={null}
            isLoading={isLoading}
            cartItems={cartQuantities}
            onAddToCart={handleAddToCartWithCustomization}
          />
        </div>
      </main>

      {/* Cart Drawer - Mobile Optimized */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-lg max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="sticky top-0 border-b border-border bg-background p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Order Summary</h2>
              <button
                onClick={() => setIsCartDrawerOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <OrderCart
                items={cartItems}
                tableNumber={table}
                isLoading={isLoading}
                onRemoveItem={handleRemoveItem}
                onSubmit={async () => {
                  await handleSubmitOrder()
                  setIsCartDrawerOpen(false)
                }}
                isSubmitting={createOrderMutation.isPending || submitOrderMutation.isPending}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
