import { Minus, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * T055: MenuList Component
 * Displays available dishes for customer ordering
 *
 * Acceptance: spec.md US1 Scenario 1
 * - Shows all available dishes with names, descriptions, prices, and photos
 * - Allows customers to add dishes to their order
 */

interface Dish {
  id: number
  name: string
  description: string
  price: number // In cents
  photoUrl: string | null
  isAvailable: boolean
  createdAt: Date
  // T063-T064: Flag fields for customer display
  isRecommended?: boolean
  isChefSpecial?: boolean
}

interface MenuListProps {
  dishes: Dish[]
  isLoading: boolean
  onAddToCart: (dishId: number, quantity: number) => void
  cartItems: Map<number, number> // dishId -> quantity
}

export function MenuList({ dishes, isLoading, onAddToCart, cartItems }: MenuListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full mb-4" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (dishes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No dishes available at the moment.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {dishes.map((dish) => {
        const quantity = cartItems.get(dish.id) || 0
        const isUnavailable = !dish.isAvailable

        return (
          <Card key={dish.id} className={isUnavailable ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{dish.name}</CardTitle>
                  {/* T063-T064: Display flag badges to customers */}
                  {dish.isRecommended && (
                    <span className="text-lg" title="Recommended">
                      👍
                    </span>
                  )}
                  {dish.isChefSpecial && (
                    <span className="text-lg" title="Chef's Special">
                      ⭐
                    </span>
                  )}
                </div>
                {isUnavailable && (
                  <Badge variant="destructive" className="shrink-0">
                    Unavailable
                  </Badge>
                )}
              </div>
              <CardDescription>{dish.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dish.photoUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                  <img src={dish.photoUrl} alt={dish.name} className="h-full w-full object-cover" />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">${(dish.price / 100).toFixed(2)}</div>

                {!isUnavailable && (
                  <div className="flex items-center gap-2">
                    {quantity === 0 ? (
                      <Button size="sm" onClick={() => onAddToCart(dish.id, 1)}>
                        <Plus className="mr-1 h-4 w-4" />
                        Add
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onAddToCart(dish.id, quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="min-w-[2rem] text-center font-semibold">{quantity}</span>
                        <Button size="sm" onClick={() => onAddToCart(dish.id, quantity + 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/**
 * T058: Out-of-stock indicators
 * - Unavailable dishes are shown with reduced opacity
 * - Badge displays "Unavailable" status
 * - Add button is disabled for unavailable dishes
 */
