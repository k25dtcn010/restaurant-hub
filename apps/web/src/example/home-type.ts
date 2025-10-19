export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  image: string
  category: string
  rating: number
  reviews: number
  prepTime: number
  extras?: MenuExtra[]
  discount?: string
}

export interface MenuExtra {
  id: string
  name: string
  price: number
  unit?: string
  quantity?: number
}

export interface CartItem {
  cartItemId: string
  menuItem: MenuItem
  quantity: number
  selectedExtras: MenuExtra[]
}

export type OrderType = "takeaway" | "dine-in" | "delivery"

export interface Order {
  id: string
  items: CartItem[]
  orderType: OrderType
  subtotal: number
  tax: number
  deliveryFee: number
  total: number
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed"
  createdAt: Date
}
