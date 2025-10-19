export interface Dish {
  id: number
  name: string
  description: string
  price: number
  photoUrl: string | null
  category?: string
  rating?: number
  reviews?: number
  prepTime?: number
  hidden?: boolean
  disabled?: boolean
}

export interface DishExtra {
  id: number
  name: string
  priceAdjustment: number
  unit?: string
  quantity?: number
}

export interface CartItem {
  cartItemId?: string
  dishId: number
  dishName: string
  quantity: number
  priceAtOrder: number
  modifiers?: SelectedModifier[]
  specialRequest?: string
}

export interface SelectedModifier {
  modifierId: number
  modifierGroupId: number
  name?: string
  priceAdjustment?: number
}

export type OrderType = "dine-in" | "takeaway" | "delivery"

export interface Order {
  id: number
  items: CartItem[]
  orderType?: OrderType
  subtotal: number
  tax?: number
  deliveryFee?: number
  total: number
  status?: "pending" | "confirmed" | "preparing" | "ready" | "completed"
  createdAt?: Date
}

export interface KitchenOrder {
  id: number
  tableNumber?: number
  items: Array<{
    dishName: string
    quantity: number
    specialRequest?: string
    modifiers?: SelectedModifier[]
  }>
  status: "pending" | "preparing" | "ready"
  createdAt: Date
}
