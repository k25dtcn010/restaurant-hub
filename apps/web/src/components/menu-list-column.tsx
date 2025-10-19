import { AlertCircle, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { MenuItemCard } from "@/components/menu-item-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * MenuListColumn Component
 * Displays menu items in a scrollable column with search functionality
 * Uses MenuItemCard component for each item in Radio Card style
 * Part of 3-column layout for staff ordering
 */

interface Dish {
  id: number
  name: string
  description: string
  price: number // In cents
  photoUrl: string | null
  isAvailable: boolean
  createdAt: Date
  isRecommended?: boolean
  isChefSpecial?: boolean
  isHidden?: boolean
}

interface MenuListColumnProps {
  dishes: Dish[]
  isLoading: boolean
  onAddToCart: (dishId: number, quantity: number) => void
  cartItems: Map<number, number> // dishId -> quantity
  requireHiddenConfirmation?: boolean
}

export function MenuListColumn({
  dishes,
  isLoading,
  onAddToCart,
  cartItems,
  requireHiddenConfirmation,
}: MenuListColumnProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredDishes = useMemo(() => {
    if (!searchQuery) return dishes
    const query = searchQuery.toLowerCase()
    return dishes.filter(
      (dish) =>
        dish.name.toLowerCase().includes(query) || dish.description.toLowerCase().includes(query)
    )
  }, [dishes, searchQuery])

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="border-b pb-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4 mt-2" />
        </CardHeader>
        <CardContent className="flex-1 space-y-2 p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (dishes.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Menu</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No dishes available at the moment.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-lg mb-1">Menu</CardTitle>
        <CardDescription className="text-xs mb-3">Select items to add to order</CardDescription>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full w-full">
          <div className="p-4">
            <FieldGroup>
              <FieldSet>
                {filteredDishes.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    <p>No dishes match your search</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDishes.map((dish) => {
                      const quantity = cartItems.get(dish.id) || 0
                      return (
                        <MenuItemCard
                          key={dish.id}
                          dish={dish}
                          quantity={quantity}
                          onQuantityChange={onAddToCart}
                          requireHiddenConfirmation={requireHiddenConfirmation}
                        />
                      )
                    })}
                  </div>
                )}
              </FieldSet>
            </FieldGroup>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
