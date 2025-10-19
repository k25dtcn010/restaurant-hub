"use client"

import { useMemo, useState } from "react"

import { HomeHeader } from "./home-header"
import type { MenuItem } from "./home-type"
import { MenuItemsSection } from "./menu-items-section"

interface HomeClientProps {
  initialMenuItems: MenuItem[]
  menuCategories: Array<{ id: string; name: string; icon: string }>
}

export function HomeClient({ initialMenuItems, menuCategories }: HomeClientProps) {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Filter items based on search and category
  const filteredItems = useMemo(() => {
    let items = initialMenuItems

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query)
      )
    }

    // Filter by category
    if (selectedCategory !== "all") {
      items = items.filter((item) => item.category === selectedCategory)
    }

    return items
  }, [initialMenuItems, searchQuery, selectedCategory])

  // Group items by category
  const groupedItems = useMemo(() => {
    if (selectedCategory === "all") {
      const groups: Record<string, typeof filteredItems> = {}
      filteredItems.forEach((item) => {
        const categoryName = item.category
        if (!groups[categoryName]) {
          groups[categoryName] = []
        }
        groups[categoryName].push(item)
      })
      return groups
    } else {
      return { [selectedCategory]: filteredItems }
    }
  }, [filteredItems, selectedCategory])

  return (
    <>
      <HomeHeader
        categories={menuCategories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="container mx-auto px-4">
        {/* Category Section Header */}
        <div className="bg-background py-3 border-b border-border z-40">
          <h2 className="text-xl font-bold">
            {selectedCategory === "all"
              ? "All Items"
              : menuCategories.find((c) => c.id === selectedCategory)?.name}
          </h2>
        </div>

        {/* Menu Items List */}
        <MenuItemsSection
          groupedItems={groupedItems}
          menuCategories={menuCategories}
          selectedCategory={selectedCategory}
        />
      </main>
    </>
  )
}
