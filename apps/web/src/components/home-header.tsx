'use client'

import { MapPin, QrCode, Search, ShoppingCart, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CartItem } from '../types/home-type'
import { Link } from '@tanstack/react-router'

interface HomeHeaderProps {
  tableNumber?: number
  searchQuery: string
  onSearchChange: (query: string) => void
  cartItems?: CartItem[]
  onOpenCartDrawer?: () => void
}

export function HomeHeader({
  tableNumber,
  searchQuery,
  onSearchChange,
  cartItems = [],
  onOpenCartDrawer,
}: HomeHeaderProps) {
  // Calculate cart summary
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cartItems.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0)

  const handleOpenCart = () => {
    if (onOpenCartDrawer) {
      onOpenCartDrawer()
    }
  }

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        {/* Top Row: Location/Table Info and Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full ${tableNumber ? 'bg-primary' : 'bg-red-500'
                } flex items-center justify-center`}
            >
              {tableNumber ? (
                <QrCode className="w-4 h-4 text-white" />
              ) : (
                <MapPin className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {tableNumber ? (
                <>
                  <p className="text-xs text-muted-foreground">Dining at</p>
                  <p className="text-sm font-medium truncate">Table {tableNumber}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Scan QR Code</p>
                  <p className="text-sm font-medium truncate">No table selected</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Cart Button - Opens Drawer from Parent */}
            <Button
              variant="outline"
              size="icon"
              className="relative"
              onClick={handleOpenCart}
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                  {totalItems}
                </span>
              )}
            </Button>

            <Link to="/dashboard">
              <Button variant="ghost" size="icon">
                <User className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for dishes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-muted border-0 h-10 rounded-lg"
          />
        </div>
      </div>
    </header>
  )
}
