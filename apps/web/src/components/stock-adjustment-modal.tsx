import { useMutation } from "@tanstack/react-query"
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
 * T107: StockAdjustmentModal Component
 * Modal for editing ingredient quantities
 *
 * Acceptance: spec.md US5 Scenario 3
 * - Manager can update ingredient quantity
 * - Changes are saved and reflected immediately
 *
 * Contract: inventory-router.md Procedure 3 (adjustStock)
 */

interface StockAdjustmentModalProps {
  ingredient: IngredientData
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StockAdjustmentModal({
  ingredient,
  open,
  onOpenChange,
}: StockAdjustmentModalProps) {
  const [adjustment, setAdjustment] = useState<string>("")
  const [reason, setReason] = useState<string>("")

  // Mutation for adjusting stock
  const adjustStockMutation = useMutation({
    mutationFn: (variables: { ingredientId: number; adjustment: number; reason?: string }) =>
      trpcClient.inventory.adjustStock.mutate(variables),
    onSuccess: (data) => {
      // Invalidate inventory queries to refetch data
      queryClient.invalidateQueries({
        predicate: (query) => {
          // tRPC query keys are arrays like [["inventory", "getAll"], {...input}]
          const queryKey = query.queryKey[0]
          return Array.isArray(queryKey) && queryKey[0] === "inventory" && queryKey[1] === "getAll"
        },
      })
      toast.success("Stock adjusted successfully", {
        description: `${ingredient.name}: ${data.oldQuantity} → ${data.newQuantity} ${ingredient.unit}`,
      })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error("Failed to adjust stock", {
        description: error.message,
      })
    },
  })

  const handleClose = () => {
    setAdjustment("")
    setReason("")
    onOpenChange(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const adjustmentValue = parseFloat(adjustment)
    if (isNaN(adjustmentValue) || adjustmentValue === 0) {
      toast.error("Invalid adjustment", {
        description: "Please enter a non-zero number",
      })
      return
    }

    // Calculate new quantity for validation
    const newQuantity = ingredient.quantity + adjustmentValue
    if (newQuantity < 0) {
      toast.error("Invalid adjustment", {
        description: `Adjustment would result in negative quantity: ${ingredient.quantity} + ${adjustmentValue} = ${newQuantity}`,
      })
      return
    }

    adjustStockMutation.mutate({
      ingredientId: ingredient.id,
      adjustment: adjustmentValue,
      reason: reason || undefined,
    })
  }

  const newQuantity = adjustment
    ? ingredient.quantity + parseFloat(adjustment)
    : ingredient.quantity

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock: {ingredient.name}</DialogTitle>
          <DialogDescription>
            Update the quantity of this ingredient. Use positive numbers to add stock, negative
            numbers to reduce stock.
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
              <Label htmlFor="adjustment">
                Adjustment <span className="text-muted-foreground">(+/-)</span>
              </Label>
              <Input
                id="adjustment"
                type="number"
                step="0.01"
                placeholder="e.g., +10 or -5"
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                required
              />
            </div>
            {adjustment && !isNaN(parseFloat(adjustment)) && (
              <div className="space-y-2">
                <Label>New Stock</Label>
                <div className={`text-2xl font-bold ${newQuantity < 0 ? "text-destructive" : ""}`}>
                  {newQuantity} {ingredient.unit}
                  {newQuantity < ingredient.threshold && (
                    <span className="text-sm text-destructive ml-2">(Below threshold)</span>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="reason"
                type="text"
                placeholder="e.g., Restocking, Spillage, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={adjustStockMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={adjustStockMutation.isPending}>
              {adjustStockMutation.isPending ? "Adjusting..." : "Adjust Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
