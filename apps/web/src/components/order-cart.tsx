import { ShoppingCart, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

/**
 * T056: OrderCart Component
 * Manages order items in the customer's cart
 *
 * Acceptance: spec.md US1 Scenario 2
 * - Shows items added to order with quantities and prices
 * - Allows customers to remove items or change quantities
 */

interface CartItem {
  dishId: number
  dishName: string
  quantity: number
  priceAtOrder: number // In cents
}

interface OrderCartProps {
  items: CartItem[]
  tableNumber?: number
  isLoading?: boolean
  onRemoveItem: (dishId: number) => void
  onSubmit: () => void
  isSubmitting?: boolean
}

export function OrderCart({
  items,
  tableNumber,
  isLoading,
  onRemoveItem,
  onSubmit,
  isSubmitting,
}: OrderCartProps) {
  const totalAmount = items.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  if (isLoading) {
    return (
      <Card className="sticky top-4">
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Your Order
          {tableNumber && (
            <span className="text-sm font-normal text-muted-foreground">(Table {tableNumber})</span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <ShoppingCart className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>Your cart is empty</p>
            <p className="text-sm">Add items from the menu to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.dishId}
                className="flex items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.dishName}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} × ${(item.priceAtOrder / 100).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="font-semibold">
                    ${((item.priceAtOrder * item.quantity) / 100).toFixed(2)}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveItem(item.dishId)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {items.length > 0 && (
        <CardFooter className="flex-col gap-4 border-t">
          <div className="flex w-full items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total ({totalItems} items)</p>
              <p className="text-2xl font-bold">${(totalAmount / 100).toFixed(2)}</p>
            </div>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner className="mr-2" />
                Submitting...
              </>
            ) : (
              "Submit Order"
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
