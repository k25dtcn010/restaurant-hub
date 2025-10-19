'use client'

import { MapPin, QrCode, Search, User } from 'lucide-react'
import Link from 'next/link'
import { CartButton } from '@/components/cart-button'
import { CategoryFilter } from '@/components/category-filter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSession } from '@/lib/auth'
import { useCartStore } from '@/lib/cart-store'

interface HomeHeaderProps {
  categories: Array<{ id: string; name: string; icon: string }>
  selectedCategory: string
  onCategoryChange: (category: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function HomeHeader({
  categories,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
}: HomeHeaderProps) {
  const { data: session } = useSession()
  // biome-ignore lint/suspicious/noExplicitAny: role field is defined in auth config but not in type
  const userRole = (session?.user as any)?.role as string | undefined
  const { tableSession } = useCartStore()

  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-3">
        {/* Delivery Address or Table Info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full ${tableSession ? 'bg-primary' : 'bg-red-500'} flex items-center justify-center`}
            >
              {tableSession ? (
                <QrCode className="w-4 h-4 text-white" />
              ) : (
                <MapPin className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {tableSession ? (
                <>
                  <p className="text-xs text-muted-foreground">Dining at</p>
                  <p className="text-sm font-medium truncate">
                    Table {tableSession.tableNumber}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Giao đến</p>
                  <p className="text-sm font-medium truncate">
                    Ha Yen Quyet St, P.Yên Hòa, TP.Hà Nội...
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session?.user ? (
              <Button variant="ghost" size="icon" asChild>
                <Link
                  href={userRole === 'customer' ? '/profile' : '/dashboard'}
                >
                  <User className="w-5 h-5" />
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">
                  <User className="w-4 h-4 mr-1" />
                  Login
                </Link>
              </Button>
            )}
            <CartButton />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for dishes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-muted border-0 h-10 rounded-lg"
          />
        </div>

        {/* Category Filter - Horizontally Scrollable */}
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
        />
      </div>
    </header>
  )
}
