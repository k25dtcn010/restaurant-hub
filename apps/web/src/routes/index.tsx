import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { TRPCClientError } from "@trpc/client"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { CategoryList } from "@/components/category-list"
import { DishCustomizationDialog } from "@/components/dish-customization-dialog"
import { MenuList } from "@/components/menu-list"
import type { SelectedModifier } from "@/components/modifier-selector"
import { OrderCart } from "@/components/order-cart"
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

interface CartItem {
  dishId: number
  dishName: string
  quantity: number
  priceAtOrder: number
  modifiers?: SelectedModifier[]
  specialRequest?: string
}

function HomeComponent() {
  const { table } = Route.useSearch()
  const [cart, setCart] = useState<Map<number, CartItem>>(new Map())
  const [customizingDish, setCustomizingDish] = useState<{
    id: number
    name: string
    description: string
    price: number
    photoUrl: string | null
  } | null>(null)
  // T062: Category filtering state
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)

  // Fetch dishes
  const { data: dishesData, isLoading: dishesLoading } = useQuery(
    trpc.dishes.getAll.queryOptions({
      includeDisabled: false,
    })
  )

  // T062: Fetch dishes for selected category
  const { data: categoryDishesData } = useQuery({
    ...trpc.categories.listDishes.queryOptions({ categoryId: selectedCategoryId || 0 }),
    enabled: selectedCategoryId !== null,
  })

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

  // T062: Filter dishes by category if a category is selected
  const allDishes = dishesData?.dishes || []
  const dishes =
    selectedCategoryId !== null && categoryDishesData
      ? allDishes.filter((dish) => categoryDishesData.some((catDish) => catDish.id === dish.id))
      : allDishes

  // Handle opening customization dialog
  const handleOpenCustomization = (dishId: number) => {
    const dish = dishes.find((d: any) => d.id === dishId)
    if (!dish) return

    setCustomizingDish({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      price: dish.price,
      photoUrl: dish.photoUrl,
    })
  }

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

    const dish = dishes.find((d: { id: number; name: string; price: number }) => d.id === dishId)
    if (!dish) return

    // Calculate price including modifiers (T043)
    const modifierTotal = modifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)
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

  // Simple cart handler for MenuList (opens customization dialog)
  const handleAddToCart = (dishId: number, quantity: number) => {
    if (quantity === 0) {
      handleAddToCartWithCustomization(dishId, 0, [], "")
    } else {
      // Open customization dialog instead of adding directly
      handleOpenCustomization(dishId)
    }
  }

  const handleRemoveItem = (dishId: number) => {
    handleAddToCart(dishId, 0)
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

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {table ? `Table ${table} - Menu` : "Restaurant Menu"}
        </h1>
        {tableData && (
          <p className="text-muted-foreground">Capacity: {tableData.capacity} people</p>
        )}
        {!table && <p className="text-muted-foreground">Scan a QR code at your table to order</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div>
          {/* T061, T062: Category browsing and filtering */}
          <CategoryList
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />

          <MenuList
            dishes={dishes as any}
            isLoading={isLoading}
            onAddToCart={handleAddToCart}
            cartItems={cartQuantities}
          />
        </div>

        <div>
          <OrderCart
            items={cartItems}
            tableNumber={table}
            isLoading={isLoading}
            onRemoveItem={handleRemoveItem}
            onSubmit={handleSubmitOrder}
            isSubmitting={createOrderMutation.isPending || submitOrderMutation.isPending}
          />
        </div>
      </div>

      {/* Dish Customization Dialog (T040) */}
      {customizingDish && (
        <DishCustomizationDialog
          dish={customizingDish}
          isOpen={true}
          onClose={() => setCustomizingDish(null)}
          onAddToCart={handleAddToCartWithCustomization}
        />
      )}
    </div>
  )
}
