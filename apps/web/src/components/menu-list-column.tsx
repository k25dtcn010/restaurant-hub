import { useQuery } from "@tanstack/react-query"
import { Search, Tag } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { MenuItemCard } from "@/components/menu-item-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { trpc } from "@/utils/trpc"

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
  categoryId?: number | null
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
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set())

  // Fetch categories (staff sees all categories including hidden ones)
  const { data: categories = [] } = useQuery({
    ...trpc.categories.list.queryOptions({ visibleOnly: false }),
  })

  // Toggle category selection
  const toggleCategory = (categoryId: number) => {
    setSelectedCategories((prev) => {
      // If clicking "All" (-1), clear all filters
      if (categoryId === -1) {
        return prev.size === 0 ? new Set() : new Set()
      }

      const next = new Set(prev)
      // Remove "All" if it was selected
      next.delete(-1)

      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  // Filter dishes by search and categories
  const filteredDishes = useMemo(() => {
    let result = dishes

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (dish) =>
          dish.name.toLowerCase().includes(query) || dish.description.toLowerCase().includes(query)
      )
    }

    // Filter by selected categories
    if (selectedCategories.size > 0) {
      result = result.filter((dish) => {
        // Only include if category is selected
        return selectedCategories.has(dish.categoryId || -1)
      })
    }

    return result
  }, [dishes, searchQuery, selectedCategories])

  // Group dishes by category for display
  const groupedDishes = useMemo(() => {
    const groups: Array<{ categoryName: string; dishes: Dish[] }> = []
    const categoryMap = new Map<string, Dish[]>()

    filteredDishes.forEach((dish) => {
      const categoryName = dish.categoryId
        ? categories.find((c) => c.id === dish.categoryId)?.name || "All"
        : "All"

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, [])
      }
      categoryMap.get(categoryName)!.push(dish)
    })

    // Convert map to array and sort (All last)
    categoryMap.forEach((dishes, categoryName) => {
      groups.push({ categoryName, dishes })
    })

    groups.sort((a, b) => {
      if (a.categoryName === "All") return 1
      if (b.categoryName === "All") return -1
      return a.categoryName.localeCompare(b.categoryName)
    })

    return groups
  }, [filteredDishes, categories])

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
          <CardTitle>{t("staffOrder.menuList.title")}</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{t("staffOrder.menuList.noItemsFound")}.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b pb-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{t("staffOrder.menuList.title")}</CardTitle>
            <CardDescription className="text-xs">{t("staffOrder.menuList.description")}</CardDescription>
          </div>

          {/* Search bar */}
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("staffOrder.menuList.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <form>
            <FieldGroup>
              <FieldSet className="gap-4">
                <FieldGroup className="flex flex-row flex-wrap gap-2 [--radius:9999rem]">
                  <FieldLabel className="!w-fit">
                    <Field
                      orientation="horizontal"
                      className="gap-1.5 overflow-hidden !px-3 !py-1.5 transition-all duration-100 ease-linear group-has-data-[state=checked]/field-label:!px-2"
                    >
                      <Checkbox
                        checked={selectedCategories.size === 0}
                        onCheckedChange={() => toggleCategory(-1)}
                        className="-ml-6 -translate-x-1 rounded-full transition-all duration-100 ease-linear data-[state=checked]:ml-0 data-[state=checked]:translate-x-0"
                      />
                      <FieldTitle>{t("staffOrder.menuList.all")}</FieldTitle>
                    </Field>
                  </FieldLabel>

                  {categories.map((category) => (
                    <FieldLabel className="!w-fit">
                      <Field
                        key={category.id}
                        orientation="horizontal"
                        className="gap-1.5 overflow-hidden !px-3 !py-1.5 transition-all duration-100 ease-linear group-has-data-[state=checked]/field-label:!px-2"
                      >
                        <Checkbox
                          checked={selectedCategories.has(category.id)}
                          onCheckedChange={() => toggleCategory(category.id)}
                          className="-ml-6 -translate-x-1 rounded-full transition-all duration-100 ease-linear data-[state=checked]:ml-0 data-[state=checked]:translate-x-0"
                        />
                        <FieldTitle>{category.name}</FieldTitle>

                        {category.isHidden && (
                          <FieldDescription>
                            <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">
                              Hidden
                            </Badge>
                          </FieldDescription>
                        )}
                      </Field>
                    </FieldLabel>
                  ))}
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </form>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full w-full">
          <div className="p-4">
            {filteredDishes.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <p>No dishes match your search</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedDishes.map(({ categoryName, dishes: categoryDishes }) => (
                  <div key={categoryName}>
                    {/* Category header */}
                    <div className="mb-3 pb-2 border-b border-border">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        {categoryName}
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {categoryDishes.length}
                        </Badge>
                      </h3>
                    </div>

                    {/* Dishes in this category */}
                    <div className="space-y-4">
                      {categoryDishes.map((dish) => {
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
