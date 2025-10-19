import { AlertCircle, Minus, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"

/**
 * MenuItemCard Component
 * Displays a menu item in Radio Card format for staff ordering
 * Based on FieldChoiceCard pattern with quantity controls
 */

interface Dish {
  id: number
  name: string
  description: string
  price: number // In cents
  photoUrl: string | null
  isAvailable: boolean
  isRecommended?: boolean
  isChefSpecial?: boolean
  isHidden?: boolean
}

interface MenuItemCardProps {
  dish: Dish
  quantity: number
  onQuantityChange: (dishId: number, quantity: number) => void
  requireHiddenConfirmation?: boolean
}

export function MenuItemCard({
  dish,
  quantity,
  onQuantityChange,
  requireHiddenConfirmation,
}: MenuItemCardProps) {
  const handleAddClick = () => {
    onQuantityChange(dish.id, 1)
  }

  const isUnavailable = !dish.isAvailable
  const isHiddenItem = dish.isHidden && requireHiddenConfirmation

  return (
    <>
      <FieldLabel htmlFor={`dish-${dish.id}`} className="cursor-pointer">
        <Field orientation="horizontal">
          <FieldContent>
            <div className={`space-y-2 w-full ${isHiddenItem ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <FieldTitle className="flex items-center gap-2 flex-wrap">
                  <span>{dish.name}</span>
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
                  {isHiddenItem && (
                    <Badge
                      variant="outline"
                      className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Hidden
                    </Badge>
                  )}
                  {isUnavailable && (
                    <Badge variant="destructive" className="text-xs">
                      Unavailable
                    </Badge>
                  )}
                </FieldTitle>
              </div>

              <FieldDescription className="line-clamp-2">{dish.description}</FieldDescription>

              {dish.photoUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                  <img src={dish.photoUrl} alt={dish.name} className="h-full w-full object-cover" />
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-lg font-bold">${(dish.price / 100).toFixed(2)}</div>

                {!isUnavailable && !isHiddenItem && (
                  <div className="flex items-center gap-2">
                    {quantity === 0 ? (
                      <Button size="sm" onClick={handleAddClick}>
                        <Plus className="mr-1 h-4 w-4" />
                        Add
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onQuantityChange(dish.id, quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="min-w-[2rem] text-center font-semibold text-sm">
                          {quantity}
                        </span>
                        <Button size="sm" onClick={() => onQuantityChange(dish.id, quantity + 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {isHiddenItem && (
                  <Badge variant="secondary" className="text-xs">
                    Not Available
                  </Badge>
                )}
              </div>
            </div>
          </FieldContent>
        </Field>
      </FieldLabel>
    </>
  )
}
