import { useMutation, useQuery } from "@tanstack/react-query"
import { Edit, GripVertical, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { trpc, trpcClient } from "@/utils/trpc"

/**
 * T036: ModifierGroupEditor Component
 * Manager-only UI for creating, editing, and managing modifier groups
 *
 * Features:
 * - List View: Groups ordered by displayOrder
 * - Create Form: Modal with name, minSelections, maxSelections, displayOrder
 * - Edit Form: Pre-populated modal for updating groups
 * - Delete: Confirm dialog with warning if group assigned to dishes
 * - Drag-and-Drop Reorder: Update displayOrder (future enhancement)
 *
 * Dependencies: T025-GREEN (listGroups), T026-GREEN (createGroup), T027-GREEN (updateGroup), T028-GREEN (deleteGroup)
 */

interface ModifierGroupFormData {
  name: string
  minSelections: number | undefined
  maxSelections: number | undefined
  displayOrder: number
}

export function ModifierGroupEditor() {
  const { t } = useTranslation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<{
    id: number
    name: string
    minSelections: number | undefined
    maxSelections: number | undefined
    displayOrder: number
  } | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [minSelections, setMinSelections] = useState("")
  const [maxSelections, setMaxSelections] = useState("")
  const [displayOrder, setDisplayOrder] = useState("")

  // Query modifier groups
  const {
    data: groups,
    isLoading,
    refetch,
  } = useQuery({
    ...trpc.modifiers.listGroups.queryOptions(),
  })

  // Create mutation
  const createGroup = useMutation({
    mutationFn: (data: ModifierGroupFormData) => trpcClient.modifiers.createGroup.mutate(data),
    onSuccess: () => {
      toast.success(t("menuManagement.modifierGroup.createdSuccess"))
      setIsDialogOpen(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.modifierGroup.createdFailed"), {
        description: error.message,
      })
    },
  })

  // Update mutation
  const updateGroup = useMutation({
    mutationFn: (data: { id: number } & Partial<ModifierGroupFormData>) =>
      trpcClient.modifiers.updateGroup.mutate(data),
    onSuccess: () => {
      toast.success(t("menuManagement.modifierGroup.updatedSuccess"))
      setIsDialogOpen(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.modifierGroup.updatedFailed"), {
        description: error.message,
      })
    },
  })

  // Delete mutation
  const deleteGroup = useMutation({
    mutationFn: (id: number) => trpcClient.modifiers.deleteGroup.mutate({ id }),
    onSuccess: () => {
      toast.success(t("menuManagement.modifierGroup.deletedSuccess"))
      setDeleteConfirmId(null)
      refetch()
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.modifierGroup.deletedFailed"), {
        description: error.message,
      })
    },
  })

  const resetForm = () => {
    setName("")
    setMinSelections("")
    setMaxSelections("")
    setDisplayOrder("")
    setEditingGroup(null)
  }

  const handleOpenCreateDialog = () => {
    resetForm()
    // Set default displayOrder to next available number
    const nextOrder = groups ? (groups as any[]).length + 1 : 1
    setDisplayOrder(nextOrder.toString())
    setIsDialogOpen(true)
  }

  const handleOpenEditDialog = (group: any) => {
    setEditingGroup({
      id: group.id,
      name: group.name,
      minSelections: group.minSelections ?? undefined,
      maxSelections: group.maxSelections ?? undefined,
      displayOrder: group.displayOrder,
    })
    setName(group.name)
    setMinSelections(group.minSelections?.toString() || "")
    setMaxSelections(group.maxSelections?.toString() || "")
    setDisplayOrder(group.displayOrder.toString())
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!name.trim()) {
      toast.error(t("menuManagement.modifierGroup.validationNameRequired"))
      return
    }

    const min = minSelections ? parseInt(minSelections) : undefined
    const max = maxSelections ? parseInt(maxSelections) : undefined
    const order = parseInt(displayOrder)

    if (isNaN(order) || order < 0) {
      toast.error(t("menuManagement.modifierGroup.validationOrderRequired"))
      return
    }

    if (min !== undefined && isNaN(min)) {
      toast.error(t("menuManagement.modifierGroup.validationMinNumber"))
      return
    }

    if (max !== undefined && isNaN(max)) {
      toast.error(t("menuManagement.modifierGroup.validationMaxNumber"))
      return
    }

    // Validate min <= max
    if (min !== undefined && max !== undefined && min > max) {
      toast.error(t("menuManagement.modifierGroup.validationMinMax"))
      return
    }

    const data: ModifierGroupFormData = {
      name: name.trim(),
      minSelections: min,
      maxSelections: max,
      displayOrder: order,
    }

    if (editingGroup) {
      updateGroup.mutate({ id: editingGroup.id, ...data })
    } else {
      createGroup.mutate(data)
    }
  }

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = () => {
    if (deleteConfirmId !== null) {
      deleteGroup.mutate(deleteConfirmId)
    }
  }

  const formatConstraint = (
    min: number | null | undefined,
    max: number | null | undefined
  ): string => {
    if ((min === null || min === undefined) && (max === null || max === undefined)) {
      return t("menuManagement.modifierGroup.noLimits")
    }
    if (min != null && max != null) {
      return t("menuManagement.modifierGroup.rangeConstraint", { min, max })
    }
    if (min != null) {
      return t("menuManagement.modifierGroup.minConstraint", { min })
    }
    return t("menuManagement.modifierGroup.maxConstraint", { max })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{t("menuManagement.modifierGroup.title")}</CardTitle>
          <Button onClick={handleOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t("menuManagement.modifierGroup.create")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            {t("menuManagement.modifierGroup.loadingGroups")}
          </div>
        ) : !groups || (groups as any[]).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t("menuManagement.modifierGroup.noGroups")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>{t("menuManagement.modifierGroup.name")}</TableHead>
                <TableHead>{t("menuManagement.modifierGroup.selectionLimits")}</TableHead>
                <TableHead>{t("menuManagement.modifierGroup.displayOrder")}</TableHead>
                <TableHead className="text-right">{t("menuManagement.categoryForm.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(groups as any[]).map((group: any) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  </TableCell>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>
                    {formatConstraint(group.minSelections, group.maxSelections)}
                  </TableCell>
                  <TableCell>{group.displayOrder}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(group)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(group.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? t("menuManagement.modifierGroup.update") : t("menuManagement.modifierGroup.create")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("menuManagement.modifierGroup.name")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Toppings, Size"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="minSelections">{t("menuManagement.modifierGroup.minSelections")}</Label>
                <Input
                  id="minSelections"
                  type="number"
                  min="0"
                  value={minSelections}
                  onChange={(e) => setMinSelections(e.target.value)}
                  placeholder={t("menuManagement.modifierGroup.minPlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxSelections">{t("menuManagement.modifierGroup.maxSelections")}</Label>
                <Input
                  id="maxSelections"
                  type="number"
                  min="0"
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(e.target.value)}
                  placeholder={t("menuManagement.modifierGroup.maxPlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="displayOrder">{t("menuManagement.modifierGroup.displayOrder")}</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  min="0"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder={t("menuManagement.modifierGroup.displayOrderPlaceholder")}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  {t("menuManagement.modifierGroup.displayOrderHint")}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t("menuManagement.modifierGroup.cancel")}
              </Button>
              <Button type="submit" disabled={createGroup.isPending || updateGroup.isPending}>
                {editingGroup ? t("menuManagement.modifierGroup.update") : t("menuManagement.modifierGroup.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("menuManagement.modifierGroup.deleteConfirm")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("menuManagement.modifierGroup.deleteConfirmMessage")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t("menuManagement.modifierGroup.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteGroup.isPending}>
              {t("menuManagement.modifierGroup.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
