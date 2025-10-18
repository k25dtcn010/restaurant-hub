import { useMutation } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { queryClient, trpcClient } from "@/utils/trpc"

import type { IngredientData } from "./inventory-table"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

/**
 * T108: ThresholdEditor Component
 * Modal for setting low-stock alert thresholds
 *
 * Acceptance: spec.md US5 Scenario 6
 * - Manager can set low-stock threshold for ingredients
 * - Alert notifications when stock falls below threshold
 *
 * Contract: inventory-router.md Procedure 4 (updateThreshold)
 */

interface ThresholdEditorProps {
  ingredient: IngredientData
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ThresholdEditor({ ingredient, open, onOpenChange }: ThresholdEditorProps) {
  const [threshold, setThreshold] = useState<string>(ingredient.threshold.toString())

  // Mutation for updating threshold
  const updateThresholdMutation = useMutation({
    mutationFn: (variables: { ingredientId: number; threshold: number }) =>
      trpcClient.inventory.updateThreshold.mutate(variables),
    onSuccess: (data) => {
      // Invalidate inventory queries to refetch data
      queryClient.invalidateQueries({
        predicate: (query) => {
          // tRPC query keys are arrays like [["inventory", "getAll"], {...input}]
          const queryKey = query.queryKey[0]
          return Array.isArray(queryKey) && queryKey[0] === "inventory" && queryKey[1] === "getAll"
        },
      })
      toast.success("Threshold updated successfully", {
        description: `${ingredient.name}: New threshold is ${data.threshold} ${ingredient.unit}`,
      })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error("Failed to update threshold", {
        description: error.message,
      })
    },
  })

  const handleClose = () => {
    setThreshold(ingredient.threshold.toString())
    onOpenChange(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const thresholdValue = parseFloat(threshold)
    if (isNaN(thresholdValue) || thresholdValue < 0) {
      toast.error("Invalid threshold", {
        description: "Threshold must be a non-negative number",
      })
      return
    }

    updateThresholdMutation.mutate({
      ingredientId: ingredient.id,
      threshold: thresholdValue,
    })
  }

  const thresholdValue = parseFloat(threshold)
  const willBeLowStock = !isNaN(thresholdValue) && ingredient.quantity < thresholdValue

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Alert Threshold: {ingredient.name}</DialogTitle>
          <DialogDescription>
            Set the minimum stock level. You'll receive an alert when stock falls below this
            threshold.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Stock</Label>
              <div className="text-2xl font-bold">
                {ingredient.quantity} {ingredient.unit}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Alert Threshold</Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    id="threshold"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g., 10"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    required
                  />
                </div>
                <div className="text-muted-foreground pb-2">{ingredient.unit}</div>
              </div>
              <p className="text-sm text-muted-foreground">
                Previous threshold: {ingredient.threshold} {ingredient.unit}
              </p>
            </div>
            {willBeLowStock && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <div className="text-sm">
                    <span className="font-semibold text-destructive">Warning:</span> Current stock (
                    {ingredient.quantity} {ingredient.unit}) is below the new threshold (
                    {thresholdValue} {ingredient.unit})
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={updateThresholdMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateThresholdMutation.isPending}>
              {updateThresholdMutation.isPending ? "Updating..." : "Update Threshold"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
