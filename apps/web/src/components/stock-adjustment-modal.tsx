import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  const [adjustment, setAdjustment] = useState<string>("")
  const [reason, setReason] = useState<string>("")

  // Mutation for adjusting stock
  const adjustStockMutation = useMutation({
    mutationFn: (variables: { ingredientId: number; adjustment: number; reason?: string }) =>
      trpcClient.inventory.adjustStock.mutate(variables),
    onSuccess: (data: any) => {
      // Invalidate inventory queries to refetch data
      queryClient.invalidateQueries({
        predicate: (query) => {
          // tRPC query keys are arrays like [["inventory", "getAll"], {...input}]
          const queryKey = query.queryKey[0]
          return Array.isArray(queryKey) && queryKey[0] === "inventory" && queryKey[1] === "getAll"
        },
      })
      toast.success(t("inventory.stockAdjustmentModal.successMessage"), {
        description: t("inventory.stockAdjustmentModal.successDescription", {
          name: ingredient.name,
          oldQuantity: data.oldQuantity,
          newQuantity: data.newQuantity,
          unit: ingredient.unit,
        }),
      })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error(t("inventory.stockAdjustmentModal.errorMessage"), {
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
      toast.error(t("inventory.stockAdjustmentModal.invalidAdjustment"), {
        description: t("inventory.stockAdjustmentModal.invalidAdjustmentDescription"),
      })
      return
    }

    // Calculate new quantity for validation
    const newQuantity = ingredient.quantity + adjustmentValue
    if (newQuantity < 0) {
      toast.error(t("inventory.stockAdjustmentModal.negativeQuantity"), {
        description: t("inventory.stockAdjustmentModal.negativeQuantityDescription", {
          oldQuantity: ingredient.quantity,
          adjustment: adjustmentValue,
          newQuantity: newQuantity,
        }),
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
          <DialogTitle>{t("inventory.stockAdjustmentModal.title", { name: ingredient.name })}</DialogTitle>
          <DialogDescription>
            {t("inventory.stockAdjustmentModal.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("inventory.stockAdjustmentModal.currentStock")}</Label>
              <div className="text-2xl font-bold">
                {ingredient.quantity} {ingredient.unit}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment">
                {t("inventory.stockAdjustmentModal.adjustment")}{" "}
                <span className="text-muted-foreground">{t("inventory.stockAdjustmentModal.adjustmentHint")}</span>
              </Label>
              <Input
                id="adjustment"
                type="number"
                step="0.01"
                placeholder={t("inventory.stockAdjustmentModal.adjustmentPlaceholder")}
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                required
              />
            </div>
            {adjustment && !isNaN(parseFloat(adjustment)) && (
              <div className="space-y-2">
                <Label>{t("inventory.stockAdjustmentModal.newStock")}</Label>
                <div className={`text-2xl font-bold ${newQuantity < 0 ? "text-destructive" : ""}`}>
                  {newQuantity} {ingredient.unit}
                  {newQuantity < ingredient.threshold && (
                    <span className="text-sm text-destructive ml-2">
                      {t("inventory.stockAdjustmentModal.belowThreshold")}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reason">
                {t("inventory.stockAdjustmentModal.reason")}{" "}
                <span className="text-muted-foreground">{t("inventory.stockAdjustmentModal.reasonHint")}</span>
              </Label>
              <Input
                id="reason"
                type="text"
                placeholder={t("inventory.stockAdjustmentModal.reasonPlaceholder")}
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
              {t("inventory.stockAdjustmentModal.cancel")}
            </Button>
            <Button type="submit" disabled={adjustStockMutation.isPending}>
              {adjustStockMutation.isPending
                ? t("inventory.stockAdjustmentModal.adjusting")
                : t("inventory.stockAdjustmentModal.adjustStockButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
