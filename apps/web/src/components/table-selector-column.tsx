import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * TableSelectorColumn Component
 * Displays tables in a scrollable column with search functionality using Field components
 * Uses FieldChoiceCard pattern with RadioGroup
 * Part of 3-column layout for staff ordering
 */

interface Table {
  id: number
  number: number
  capacity: number
  hasActiveOrder: boolean
}

interface TableSelectorColumnProps {
  tables: Table[]
  isLoading: boolean
  selectedTableId: number | null
  onSelectTable: (tableId: number) => void
}

export function TableSelectorColumn({
  tables,
  isLoading,
  selectedTableId,
  onSelectTable,
}: TableSelectorColumnProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredTables = useMemo(() => {
    if (!searchQuery) return tables
    return tables.filter(
      (table) =>
        table.number.toString().includes(searchQuery) ||
        table.capacity.toString().includes(searchQuery)
    )
  }, [tables, searchQuery])

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="border-b pb-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4 mt-2" />
        </CardHeader>
        <CardContent className="flex-1 space-y-2 p-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (tables.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{t("staffOrder.tableSelector.title")}</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{t("staffOrder.tableSelector.noTablesAvailable")}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-lg mb-1">{t("staffOrder.tableSelector.title")}</CardTitle>
        <CardDescription className="text-xs mb-3">
          {t("staffOrder.tableSelector.description")}
        </CardDescription>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("staffOrder.tableSelector.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full w-full">
          <div className="p-4">
            <FieldGroup>
              <FieldSet>
                <RadioGroup value={selectedTableId?.toString() || ""}>
                  {filteredTables.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      <p>{t("staffOrder.tableSelector.noTablesMatch")}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTables.map((table) => (
                        <FieldLabel
                          key={table.id}
                          htmlFor={`table-${table.id}`}
                          className="cursor-pointer"
                        >
                          <Field orientation="horizontal">
                            <FieldContent>
                              <FieldTitle className="text-base">
                                Table {table.number}{" "}
                                {table.hasActiveOrder && (
                                  <Badge variant="secondary" className="shrink-0 text-xs">
                                    {t("staffOrder.tableSelector.inUse")}
                                  </Badge>
                                )}
                              </FieldTitle>
                              <FieldDescription className="text-sm">
                                <div>{table.capacity} {t("staffOrder.tableSelector.seats")}</div>
                              </FieldDescription>
                            </FieldContent>
                            <RadioGroupItem
                              value={table.id.toString()}
                              id={`table-${table.id}`}
                              aria-label={`Table ${table.number}`}
                              onClick={() => onSelectTable(table.id)}
                            />
                          </Field>
                        </FieldLabel>
                      ))}
                    </div>
                  )}
                </RadioGroup>
              </FieldSet>
            </FieldGroup>
          </div>
        </ScrollArea>
      </CardContent>

      {selectedTableId && (
        <CardContent className="border-t p-3 text-xs text-muted-foreground">
          <p className="font-medium">
            Table {tables.find((t) => t.id === selectedTableId)?.number} selected
          </p>
        </CardContent>
      )}
    </Card>
  )
}
