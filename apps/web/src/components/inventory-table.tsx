import { useTranslation } from "react-i18next"

import { IngredientRow } from "./ingredient-row"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"

/**
 * T105: InventoryTable Component
 * Displays all ingredients in a table format
 *
 * Acceptance: spec.md US5 Scenario 1
 * - Shows all ingredients with quantities, units, and thresholds
 *
 * Contract: inventory-router.md Procedure 1 Output
 */

export interface IngredientData {
  id: number
  name: string
  quantity: number
  unit: string
  threshold: number
  isLowStock: boolean
  updatedAt: string | Date
  usedInDishes?: Array<{
    dishId: number
    dishName: string
    quantityRequired: number
  }>
}

interface InventoryTableProps {
  ingredients: IngredientData[]
}

export function InventoryTable({ ingredients }: InventoryTableProps) {
  const { t } = useTranslation()
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">{t("inventory.table.ingredient")}</TableHead>
            <TableHead className="text-right">{t("inventory.table.currentStock")}</TableHead>
            <TableHead className="text-right">{t("inventory.table.threshold")}</TableHead>
            <TableHead className="text-right">{t("inventory.table.status")}</TableHead>
            <TableHead className="w-[140px]">{t("inventory.table.usedIn")}</TableHead>
            <TableHead className="w-[100px] text-right">{t("inventory.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.map((ingredient) => (
            <IngredientRow key={ingredient.id} ingredient={ingredient} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
