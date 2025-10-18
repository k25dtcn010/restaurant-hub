import { CheckCircle2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * T081: TableSelector Component
 * Component for staff to select which table they're creating an order for
 *
 * Acceptance: spec.md US3 Scenario 1
 * - Staff can browse available tables
 * - Shows table number, capacity, and availability status
 * - Allows selection of any table to create an order
 */

interface Table {
  id: number
  number: number
  capacity: number
  hasActiveOrder: boolean
}

interface TableSelectorProps {
  tables: Table[]
  isLoading: boolean
  selectedTableId: number | null
  onSelectTable: (tableId: number) => void
}

export function TableSelector({
  tables,
  isLoading,
  selectedTableId,
  onSelectTable,
}: TableSelectorProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (tables.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No tables available. Please contact management.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Table</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose which table you're creating an order for
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {tables.map((table) => {
            const isSelected = table.id === selectedTableId
            return (
              <Button
                key={table.id}
                variant={isSelected ? "default" : "outline"}
                className="h-auto flex-col p-4 relative"
                onClick={() => onSelectTable(table.id)}
              >
                {isSelected && <CheckCircle2 className="absolute top-1 right-1 h-4 w-4" />}
                <div className="text-2xl font-bold mb-1">{table.number}</div>
                <div className="text-xs text-muted-foreground">{table.capacity} seats</div>
                {table.hasActiveOrder && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    In Use
                  </Badge>
                )}
              </Button>
            )
          })}
        </div>
        {selectedTableId && (
          <div className="mt-4 p-3 rounded-lg bg-muted text-sm">
            <p className="font-medium">
              Table {tables.find((t) => t.id === selectedTableId)?.number} selected
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              You can now add items to the order for this table
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
