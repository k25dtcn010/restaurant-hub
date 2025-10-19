import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Info } from "lucide-react"
import { useEffect, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { trpc } from "@/utils/trpc"

/**
 * T039: ModifierSelector Component
 * Customer-facing UI for selecting modifiers when ordering dishes
 *
 * Features:
 * - Display modifier groups with their modifiers
 * - Show selection constraints (min/max)
 * - Checkbox/radio selection based on max selections
 * - Price adjustment indicators
 * - Validation with error messages
 * - Real-time validation feedback
 *
 * Dependencies: T030-GREEN (getByDish procedure)
 */

export interface SelectedModifier {
  modifierId: number
  modifierGroupId: number
  name: string
  priceAdjustment: number
}

interface ModifierSelectorProps {
  dishId: number
  onModifiersChange: (modifiers: SelectedModifier[]) => void
  onValidationChange?: (isValid: boolean) => void
}

export function ModifierSelector({
  dishId,
  onModifiersChange,
  onValidationChange,
}: ModifierSelectorProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([])
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({})

  // Query modifiers for this dish, grouped by modifier groups
  const { data: modifierGroups, isLoading } = useQuery({
    ...trpc.modifiers.getByDish.queryOptions({ dishId }),
  })

  useEffect(() => {
    // Notify parent of selected modifiers
    onModifiersChange(selectedModifiers)

    // Validate selections
    if (modifierGroups) {
      validateSelections()
    }
  }, [selectedModifiers, modifierGroups])

  const validateSelections = () => {
    const errors: Record<number, string> = {}
    let isValid = true

    modifierGroups?.forEach((group: any) => {
      const groupId = group.group.id
      const selectedCount = selectedModifiers.filter((m) => m.modifierGroupId === groupId).length

      const minSelections = group.group.minSelections
      const maxSelections = group.group.maxSelections

      // Check minimum constraint
      if (minSelections != null && selectedCount < minSelections) {
        errors[groupId] =
          `Please select at least ${minSelections} item${minSelections > 1 ? "s" : ""}`
        isValid = false
      }

      // Check maximum constraint
      if (maxSelections != null && selectedCount > maxSelections) {
        errors[groupId] = `Maximum ${maxSelections} item${maxSelections > 1 ? "s" : ""} allowed`
        isValid = false
      }
    })

    setValidationErrors(errors)
    if (onValidationChange) {
      onValidationChange(isValid)
    }
  }

  const handleModifierToggle = (
    modifierId: number,
    modifierGroupId: number,
    modifierName: string,
    priceAdjustment: number,
    checked: boolean,
    maxSelections: number | null | undefined
  ) => {
    if (checked) {
      // Check if adding would exceed max selections for this group
      const currentCount = selectedModifiers.filter(
        (m) => m.modifierGroupId === modifierGroupId
      ).length

      if (maxSelections != null && currentCount >= maxSelections) {
        // If max is 1, replace the existing selection (radio behavior)
        if (maxSelections === 1) {
          setSelectedModifiers([
            ...selectedModifiers.filter((m) => m.modifierGroupId !== modifierGroupId),
            { modifierId, modifierGroupId, name: modifierName, priceAdjustment },
          ])
        }
        // Otherwise, don't allow adding more
        return
      }

      // Add the modifier
      setSelectedModifiers([
        ...selectedModifiers,
        { modifierId, modifierGroupId, name: modifierName, priceAdjustment },
      ])
    } else {
      // Remove the modifier
      setSelectedModifiers(
        selectedModifiers.filter(
          (m) => !(m.modifierId === modifierId && m.modifierGroupId === modifierGroupId)
        )
      )
    }
  }

  const isModifierSelected = (modifierId: number, modifierGroupId: number): boolean => {
    return selectedModifiers.some(
      (m) => m.modifierId === modifierId && m.modifierGroupId === modifierGroupId
    )
  }

  const formatPrice = (priceInCents: number): string => {
    if (priceInCents === 0) return ""
    const value = Math.abs(priceInCents) / 100
    const sign = priceInCents > 0 ? "+" : "-"
    return `${sign}$${value.toFixed(2)}`
  }

  const formatConstraint = (
    min: number | null | undefined,
    max: number | null | undefined
  ): string => {
    if ((min == null || min === 0) && max == null) {
      return "Optional"
    }
    if (min != null && max != null && min === max) {
      return `Select exactly ${min}`
    }
    if (min != null && max != null) {
      return `Select ${min}-${max}`
    }
    if (min != null && min > 0) {
      return `Select at least ${min}`
    }
    if (max != null) {
      return `Select up to ${max}`
    }
    return ""
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>

        {/* Skeleton for modifier groups */}
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <div key={groupIndex} className="border rounded-lg p-4 space-y-3">
            {/* Group header skeleton */}
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>

            {/* Modifier items skeleton */}
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, modIndex) => (
                <div key={modIndex} className="flex items-center space-x-3 p-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!modifierGroups || modifierGroups.length === 0) {
    return null // No modifiers for this dish
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Customize Your Order</h3>
      </div>

      {modifierGroups.map((group: any) => {
        const groupId = group.group.id
        const groupName = group.group.name
        const minSelections = group.group.minSelections
        const maxSelections = group.group.maxSelections
        const modifiers = group.modifiers || []

        const selectedCount = selectedModifiers.filter((m) => m.modifierGroupId === groupId).length

        const hasError = validationErrors[groupId]

        return (
          <div key={groupId} className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <Label className="text-base font-medium">{groupName}</Label>
                <p className="text-sm text-muted-foreground">
                  {formatConstraint(minSelections, maxSelections)}
                </p>
              </div>
              <Badge variant={hasError ? "destructive" : "outline"}>{selectedCount} selected</Badge>
            </div>

            {hasError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{hasError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              {modifiers.map((modifier: any) => {
                const isSelected = isModifierSelected(modifier.id, groupId)
                const isDisabled =
                  !isSelected && maxSelections != null && selectedCount >= maxSelections

                return (
                  <div
                    key={modifier.id}
                    className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${
                      isDisabled ? "opacity-50" : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      id={`modifier-${groupId}-${modifier.id}`}
                      checked={isSelected}
                      disabled={isDisabled}
                      onCheckedChange={(checked) =>
                        handleModifierToggle(
                          modifier.id,
                          groupId,
                          modifier.name,
                          modifier.priceAdjustment,
                          checked as boolean,
                          maxSelections
                        )
                      }
                    />
                    <label
                      htmlFor={`modifier-${groupId}-${modifier.id}`}
                      className={`flex-1 text-sm ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span className="font-medium">{modifier.name}</span>
                      {modifier.priceAdjustment !== 0 && (
                        <span className="text-muted-foreground ml-2">
                          {formatPrice(modifier.priceAdjustment)}
                        </span>
                      )}
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
