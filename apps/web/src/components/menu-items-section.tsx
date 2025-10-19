'use client'

import { useState } from 'react'
import { DishCustomizationDialog } from '@/components/dish-customization-dialog'
import type { Dish, SelectedModifier } from '../types/home-type'

interface MenuItemsSectionProps {
  groupedItems: Record<string, Dish[]>
  selectedCategory: string | null
  isLoading?: boolean
  cartItems?: Map<number, number>
  onAddToCart?: (dishId: number, quantity: number, modifiers: SelectedModifier[], specialRequest: string) => void
}

export function MenuItemsSection({
  groupedItems,
  selectedCategory,
  isLoading = false,
  cartItems = new Map(),
  onAddToCart,
}: MenuItemsSectionProps) {
  const [customizingDish, setCustomizingDish] = useState<Dish | null>(null)

  const handleQuickAdd = (dish: Dish) => {
    if (dish.id) {
      setCustomizingDish(dish)
    }
  }

  const handleAddWithCustomization = (
    dishId: number,
    quantity: number,
    modifiers: SelectedModifier[],
    specialRequest: string
  ) => {
    if (onAddToCart) {
      onAddToCart(dishId, quantity, modifiers, specialRequest)
    }
    setCustomizingDish(null)
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading menu...</p>
      </div>
    )
  }

  const entries = Object.entries(groupedItems)
  const hasItems = entries.some(([_, items]) => items.length > 0)

  return (
    <>
      {selectedCategory === null ? (
        // Show grouped items by category
        entries.map(([categoryName, items]) => {
          if (items.length === 0) return null

          return (
            <div key={categoryName} className="mb-8">
              {/* Category Header */}
              <div className="sticky top-0 bg-background py-3 border-b border-border z-40">
                <h3 className="text-lg font-semibold text-foreground">{categoryName}</h3>
              </div>

              {/* Category Items */}
              <div className="divide-y divide-border">
                {items.map((dish) => {
                  const cartQty = cartItems.get(dish.id) || 0
                  return (
                    <div
                      key={dish.id}
                      className="flex gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleQuickAdd(dish)}
                    >
                      {/* Image */}
                      {dish.photoUrl && (
                        <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
                          <img
                            src={dish.photoUrl}
                            alt={dish.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-medium text-foreground">{dish.name}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {dish.description}
                            </p>
                          </div>
                          {cartQty > 0 && (
                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold leading-none text-white transform bg-primary rounded-full">
                              {cartQty}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-foreground">
                            ${dish.price.toFixed(2)}
                          </span>
                          {dish.prepTime && (
                            <span className="text-xs text-muted-foreground">
                              ~{dish.prepTime}m
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      ) : (
        // Show items for selected category
        <div className="divide-y divide-border">
          {entries.flatMap(([_, items]) =>
            items.map((dish) => {
              const cartQty = cartItems.get(dish.id) || 0
              return (
                <div
                  key={dish.id}
                  className="flex gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleQuickAdd(dish)}
                >
                  {/* Image */}
                  {dish.photoUrl && (
                    <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={dish.photoUrl}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-foreground">{dish.name}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {dish.description}
                        </p>
                      </div>
                      {cartQty > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold leading-none text-white transform bg-primary rounded-full">
                          {cartQty}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-semibold text-foreground">
                        ${dish.price.toFixed(2)}
                      </span>
                      {dish.prepTime && (
                        <span className="text-xs text-muted-foreground">
                          ~{dish.prepTime}m
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            }),
          )}
        </div>
      )}

      {!hasItems && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No items found</p>
        </div>
      )}

      {/* Dish Customization Dialog */}
      {customizingDish && (
        <DishCustomizationDialog
          dish={customizingDish}
          isOpen={!!customizingDish}
          onClose={() => setCustomizingDish(null)}
          onAddToCart={handleAddWithCustomization}
        />
      )}
    </>
  )
}
