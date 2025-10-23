import { AlertTriangle, Check, Edit, Eye } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { IngredientData } from "./inventory-table"
import { StockAdjustmentModal } from "./stock-adjustment-modal"
import { ThresholdEditor } from "./threshold-editor"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { TableCell, TableRow } from "./ui/table"

/**
 * T106: IngredientRow Component
 * Displays a single ingredient row with low-stock highlighting
 *
 * Acceptance: spec.md US5 Scenario 2
 * - Low-stock items highlighted with red background or warning icon
 *
 * T109: Visual alerts for low-stock ingredients
 * - Red background for low-stock rows
 * - Warning icon and badge
 */

interface IngredientRowProps {
  ingredient: IngredientData
}

export function IngredientRow({ ingredient }: IngredientRowProps) {
  const { t } = useTranslation()
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showThresholdModal, setShowThresholdModal] = useState(false)
  const [showDishesDialog, setShowDishesDialog] = useState(false)

  // Low-stock highlighting (T109)
  const rowClassName = ingredient.isLowStock ? "bg-destructive/10 hover:bg-destructive/20" : ""

  return (
    <>
      <TableRow className={rowClassName}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {ingredient.isLowStock && <AlertTriangle className="h-4 w-4 text-destructive" />}
            {ingredient.name}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <span className="font-mono">
              {ingredient.quantity} {ingredient.unit}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="font-mono text-muted-foreground">
              {ingredient.threshold} {ingredient.unit}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => setShowThresholdModal(true)}
            >
              <Edit className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
        <TableCell className="text-right">
          {ingredient.isLowStock ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t("inventory.table.lowStock")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" />
              {t("inventory.table.inStock")}
            </Badge>
          )}
        </TableCell>
        <TableCell>
          {ingredient.usedInDishes && ingredient.usedInDishes.length > 0 ? (
            <Dialog open={showDishesDialog} onOpenChange={setShowDishesDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                  <Eye className="h-4 w-4 mr-1" />
                  {t("inventory.table.dishes", { count: ingredient.usedInDishes.length })}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("inventory.modal.dishesUsing", { name: ingredient.name })}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {ingredient.usedInDishes.map((dish) => (
                    <div
                      key={dish.dishId}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span>{dish.dishName}</span>
                      <span className="text-sm text-muted-foreground">
                        {dish.quantityRequired} {ingredient.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <span className="text-sm text-muted-foreground">{t("inventory.table.notUsed")}</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <Button variant="outline" size="sm" onClick={() => setShowAdjustModal(true)}>
            {t("inventory.table.adjust")}
          </Button>
        </TableCell>
      </TableRow>

      {/* Modals */}
      <StockAdjustmentModal
        ingredient={ingredient}
        open={showAdjustModal}
        onOpenChange={setShowAdjustModal}
      />
      <ThresholdEditor
        ingredient={ingredient}
        open={showThresholdModal}
        onOpenChange={setShowThresholdModal}
      />
    </>
  )
}
