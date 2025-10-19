'use client'

import { useState } from 'react'
import { ExtrasDrawer } from '@/components/extra-drawer'
import { MenuItemCard } from '@/components/menu-item-card'
import { useCartStore } from '@/lib/cart-store'
import type { MenuExtra, MenuItem } from '@/lib/types'

interface MenuItemsSectionProps {
  groupedItems: Record<string, MenuItem[]>
  menuCategories: Array<{ id: string; name: string; icon: string }>
  selectedCategory: string
  isLoading?: boolean
}

export function MenuItemsSection({
  groupedItems,
  menuCategories,
  selectedCategory,
  isLoading = false,
}: MenuItemsSectionProps) {
  const [extrasDrawerOpen, setExtrasDrawerOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const addItem = useCartStore((state) => state.addItem)

  const handleQuickAdd = (item: MenuItem) => {
    if (item.extras && item.extras.length > 0) {
      setSelectedItem(item)
      setExtrasDrawerOpen(true)
    } else {
      addItem(item, [])
    }
  }

  const handleAddWithExtras = (selectedExtras: MenuExtra[]) => {
    if (selectedItem) {
      addItem(selectedItem, selectedExtras)
    }
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
      {selectedCategory === 'all' ? (
        // Show grouped items by category
        entries.map(([categoryId, items]) => {
          const category = menuCategories.find((c) => c.id === categoryId)
          if (items.length === 0) return null

          return (
            <div key={categoryId} className="mb-8">
              {/* Category Header */}
              <div className="sticky top-0 bg-background py-3 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  {category?.name || 'Unknown Category'}
                </h3>
              </div>

              {/* Category Items */}
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onAddToCart={() => handleQuickAdd(item)}
                    onOpenExtras={() => {
                      setSelectedItem(item)
                      setExtrasDrawerOpen(true)
                    }}
                    variant="list"
                  />
                ))}
              </div>
            </div>
          )
        })
      ) : (
        // Show items for selected category
        <div className="divide-y divide-border">
          {entries.flatMap(([_, items]) =>
            items.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                onAddToCart={() => handleQuickAdd(item)}
                onOpenExtras={() => {
                  setSelectedItem(item)
                  setExtrasDrawerOpen(true)
                }}
                variant="list"
              />
            )),
          )}
        </div>
      )}

      {!hasItems && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No items found</p>
        </div>
      )}

      {selectedItem && (
        <ExtrasDrawer
          item={selectedItem}
          open={extrasDrawerOpen}
          onOpenChange={setExtrasDrawerOpen}
          onAddToCart={handleAddWithExtras}
        />
      )}
    </>
  )
}
