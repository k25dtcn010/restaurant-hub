import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { ModifierSelector, type SelectedModifier } from "@/components/modifier-selector"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { VariantSelector } from "@/components/variant-selector"
import { trpc } from "@/utils/trpc"

/**
 * T040: DishCustomizationDialog Component
 * Integrates modifier selection into dish detail/order flow
 *
 * T042: Adds special request text input to dish customization
 *
 * T077-T079: Adds variant selection with pricing
 *
 * Features:
 * - Modal dialog for customizing dishes before adding to cart
 * - Variant selection (T077-T078)
 * - Modifier selection via ModifierSelector component
 * - Special request text input (max 200 characters)
 * - Character counter for special request
 * - Validation before adding to cart
 * - Display total price including variants and modifiers (T079)
 */

interface DishCustomizationDialogProps {
  dish: {
    id: number
    name: string
    description: string
    price: number // in cents
    photoUrl: string | null
  }
  isOpen: boolean
  onClose: () => void
  onAddToCart: (
    dishId: number,
    quantity: number,
    modifiers: SelectedModifier[],
    specialRequest: string,
    variantId?: number
  ) => void
  initialQuantity?: number
}

export function DishCustomizationDialog({
  dish,
  isOpen,
  onClose,
  onAddToCart,
  initialQuantity = 1,
}: DishCustomizationDialogProps) {
  const [quantity, setQuantity] = useState(initialQuantity)
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([])
  const [specialRequest, setSpecialRequest] = useState("")
  const [isValid, setIsValid] = useState(true)
  // T077: Variant selection state
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)

  const maxSpecialRequestLength = 200

  // T077: Query variants for the dish
  const { data: variantsData } = useQuery({
    ...trpc.dishes.listVariants.queryOptions({ dishId: dish.id }),
  })

  const variants = variantsData?.variants || []

  const handleAdd = () => {
    // T078: Validate variant selection if dish has variants
    if (variants.length > 0 && !selectedVariantId) {
      return
    }

    if (!isValid) {
      return
    }

    onAddToCart(
      dish.id,
      quantity,
      selectedModifiers,
      specialRequest.trim(),
      selectedVariantId || undefined
    )
    handleClose()
  }

  const handleClose = () => {
    // Reset state
    setQuantity(1)
    setSelectedModifiers([])
    setSpecialRequest("")
    setIsValid(true)
    setSelectedVariantId(null)
    onClose()
  }

  // T079: Calculate total price with variant
  const selectedVariant = variants.find((v: any) => v.id === selectedVariantId)
  const basePrice = selectedVariant ? selectedVariant.price : dish.price
  const modifierTotal = selectedModifiers.reduce((sum, m) => sum + m.priceAdjustment, 0)
  const itemTotal = (basePrice + modifierTotal) * quantity

  const formatPrice = (priceInCents: number): string => {
    return `$${(priceInCents / 100).toFixed(2)}`
  }

  // T078: Check if add to cart should be disabled
  const isAddDisabled = !isValid || (variants.length > 0 && !selectedVariantId)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize: {dish.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dish Details */}
          <div className="space-y-2">
            {dish.photoUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                <img src={dish.photoUrl} alt={dish.name} className="h-full w-full object-cover" />
              </div>
            )}
            <p className="text-sm text-muted-foreground">{dish.description}</p>
            <div className="text-lg font-semibold">{formatPrice(dish.price)}</div>
          </div>

          {/* T077: Variant Selection */}
          {variants.length > 0 && (
            <VariantSelector
              variants={variants}
              selectedVariantId={selectedVariantId}
              onSelect={setSelectedVariantId}
              required={true}
            />
          )}

          {/* Modifier Selection */}
          <ModifierSelector
            dishId={dish.id}
            onModifiersChange={setSelectedModifiers}
            onValidationChange={setIsValid}
          />

          {/* Special Request (T042) */}
          <div className="space-y-2">
            <Label htmlFor="special-request">Special Request (optional)</Label>
            <textarea
              id="special-request"
              value={specialRequest}
              onChange={(e) => {
                if (e.target.value.length <= maxSpecialRequestLength) {
                  setSpecialRequest(e.target.value)
                }
              }}
              placeholder="Any special requests? (e.g., no pickles, extra lettuce)"
              maxLength={maxSpecialRequestLength}
              className="w-full min-h-[80px] px-3 py-2 border border-input bg-background rounded-md resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {specialRequest.length}/{maxSpecialRequestLength} characters
            </p>
          </div>

          {/* Quantity Selection */}
          <div className="space-y-2">
            <Label>Quantity</Label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                -
              </Button>
              <span className="text-lg font-semibold min-w-[3rem] text-center">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </Button>
            </div>
          </div>

          {/* Price Breakdown (T043, T079) */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Base Price {selectedVariant && `(${selectedVariant.name})`}
              </span>
              <span>{formatPrice(basePrice)}</span>
            </div>
            {selectedModifiers.length > 0 && (
              <>
                {selectedModifiers.map((modifier, index) => (
                  <div key={index} className="flex justify-between text-sm pl-4">
                    <span className="text-muted-foreground">+ {modifier.name}</span>
                    <span>{formatPrice(modifier.priceAdjustment)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-medium">
                  <span>Subtotal per item</span>
                  <span>{formatPrice(basePrice + modifierTotal)}</span>
                </div>
              </>
            )}
            {quantity > 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span>× {quantity}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span>{formatPrice(itemTotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleAdd} disabled={isAddDisabled}>
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
