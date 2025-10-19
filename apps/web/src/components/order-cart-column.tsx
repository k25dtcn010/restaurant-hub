import { ShoppingCart, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * OrderCartColumn Component
 * Displays order cart in a scrollable column
 * Part of 3-column layout for staff ordering
 */

interface CartItem {
  dishId: number
  dishName: string
  quantity: number
  priceAtOrder: number // In cents
}

interface OrderCartColumnProps {
  items: CartItem[]
  tableNumber?: number
  isLoading?: boolean
  onRemoveItem: (dishId: number) => void
  onSubmit: () => void
  isSubmitting?: boolean
}

export function OrderCartColumn({
  items,
  tableNumber,
  isLoading,
  onRemoveItem,
  onSubmit,
  isSubmitting,
}: OrderCartColumnProps) {
  const totalAmount = items.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
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
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingCart className="h-5 w-5" />
          Order
          {tableNumber && (
            <Badge variant="outline" className="ml-auto text-sm">
              Table {tableNumber}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
            <ShoppingCart className="mb-2 h-12 w-12 opacity-50" />
            <p className="text-sm">Your cart is empty</p>
            <p className="text-xs">Add items from the menu</p>
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <div className="space-y-2 p-4">
              {items.map((item) => (
                <div
                  key={item.dishId}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3 bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.dishName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × ${(item.priceAtOrder / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-semibold text-sm">
                      ${((item.priceAtOrder * item.quantity) / 100).toFixed(2)}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveItem(item.dishId)}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {items.length > 0 && (
        <CardFooter className="flex-col gap-3 border-t p-4">
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${(totalAmount / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <div className="font-medium">Total ({totalItems} items)</div>
              <div className="text-xl font-bold">${(totalAmount / 100).toFixed(2)}</div>
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Order"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
