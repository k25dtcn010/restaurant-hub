import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { trpc } from "@/utils/trpc"

/**
 * T061: CategoryList Component
 * Customer-facing component for browsing menu by categories
 *
 * Features:
 * - Display all visible categories with icons and dish counts
 * - Ordered by displayOrder
 * - Click to filter dishes by category
 * - "All" button to show all dishes
 *
 * Dependencies: Backend categories router (categories.list)
 */

interface CategoryListProps {
  selectedCategoryId: number | null
  onSelectCategory: (categoryId: number | null) => void
}

export function CategoryList({ selectedCategoryId, onSelectCategory }: CategoryListProps) {
  // Query visible categories only (customers don't see hidden categories)
  const {
    data: categories,
    isLoading,
  } = useQuery({
    ...trpc.categories.list.queryOptions({ visibleOnly: true }),
  })

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-32 shrink-0 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!categories || categories.length === 0) {
    return null // No categories to display
  }

  return (
    <div className="mb-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {/* "All" button to clear filter */}
        <Button
          variant={selectedCategoryId === null ? "default" : "outline"}
          size="lg"
          onClick={() => onSelectCategory(null)}
          className="shrink-0"
        >
          All
        </Button>

        {/* Category buttons */}
        {categories.map((category: any) => (
          <Card
            key={category.id}
            className={`shrink-0 cursor-pointer transition-all hover:shadow-md ${
              selectedCategoryId === category.id
                ? "border-primary ring-2 ring-primary ring-offset-2"
                : ""
            }`}
            onClick={() => onSelectCategory(category.id)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              {/* Category icon (emoji or image) */}
              {category.iconUrl && (
                <span className="text-2xl">{category.iconUrl}</span>
              )}

              {/* Category name and dish count */}
              <div className="flex flex-col">
                <span className="font-semibold text-sm">{category.name}</span>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {category.dishCount} {category.dishCount === 1 ? "dish" : "dishes"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
