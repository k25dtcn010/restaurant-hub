/**
 * T077: Variant Selector Component
 * Component for customers to select dish variants when ordering
 * 
 * Features:
 * - Radio buttons for variants (only one selection allowed)
 * - Display price for each variant
 * - Required selection if dish has variants
 * 
 * Props:
 * - variants: DishVariant[] - Available variants
 * - selectedVariantId: number | null - Currently selected variant
 * - onSelect: (variantId: number) => void - Callback when variant selected
 * - required: boolean - Whether selection is required
 */

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface DishVariant {
  id: number
  name: string
  price: number
  displayOrder: number
}

interface VariantSelectorProps {
  variants: DishVariant[]
  selectedVariantId: number | null
  onSelect: (variantId: number) => void
  required?: boolean
}

export function VariantSelector({
  variants,
  selectedVariantId,
  onSelect,
  required = false,
}: VariantSelectorProps) {
  if (variants.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          Select Size/Option {required && <span className="text-destructive">*</span>}
        </Label>
      </div>

      <RadioGroup
        value={selectedVariantId?.toString() || ""}
        onValueChange={(value) => onSelect(parseInt(value, 10))}
      >
        <div className="space-y-2">
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent"
            >
              <RadioGroupItem value={variant.id.toString()} id={`variant-${variant.id}`} />
              <Label
                htmlFor={`variant-${variant.id}`}
                className="flex flex-1 cursor-pointer items-center justify-between"
              >
                <span className="font-medium">{variant.name}</span>
                <span className="text-muted-foreground">${(variant.price / 100).toFixed(2)}</span>
              </Label>
            </div>
          ))}
        </div>
      </RadioGroup>

      {required && !selectedVariantId && (
        <p className="text-sm text-destructive">Please select a size/option to continue</p>
      )}
    </div>
  )
}
