import { useMutation, useQuery } from "@tanstack/react-query"
import { Edit, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
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
 * T035: ModifierManager Component
 * Manager-only UI for creating, editing, and managing modifiers
 *
 * Features:
 * - List View: Table with Name, Price Adjustment, Available Status, Actions
 * - Create Form: Modal with name, priceAdjustment, isAvailable toggle
 * - Edit Form: Pre-populated modal for updating modifiers
 * - Delete: Confirm dialog with warning if modifier assigned to dishes
 *
 * Dependencies: T021-GREEN (list), T022-GREEN (create), T023-GREEN (update), T024-GREEN (delete)
 */

interface ModifierFormData {
  name: string
  priceAdjustment: number
  isAvailable: boolean
}

export function ModifierManager() {
  const { t } = useTranslation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingModifier, setEditingModifier] = useState<{
    id: number
    name: string
    priceAdjustment: number
    isAvailable: boolean
  } | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [priceAdjustment, setPriceAdjustment] = useState("")
  const [isAvailable, setIsAvailable] = useState(true)

  // Query modifiers
  const {
    data: modifiers,
    isLoading,
    refetch,
  } = useQuery({
    ...trpc.modifiers.list.queryOptions({ availableOnly: false }),
  })

  // Create mutation
  const createModifier = useMutation({
    mutationFn: (data: ModifierFormData) => trpcClient.modifiers.create.mutate(data),
    onSuccess: () => {
      toast.success(t("menuManagement.modifierForm.createdSuccess"))
      setIsDialogOpen(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.modifierForm.createdFailed"), {
        description: error.message,
      })
    },
  })

  // Update mutation
  const updateModifier = useMutation({
    mutationFn: (data: { id: number } & Partial<ModifierFormData>) =>
      trpcClient.modifiers.update.mutate(data),
    onSuccess: () => {
      toast.success(t("menuManagement.modifierForm.updatedSuccess"))
      setIsDialogOpen(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.modifierForm.updatedFailed"), {
        description: error.message,
      })
    },
  })

  // Delete mutation
  const deleteModifier = useMutation({
    mutationFn: (id: number) => trpcClient.modifiers.delete.mutate({ id }),
    onSuccess: () => {
      toast.success(t("menuManagement.modifierForm.deletedSuccess"))
      setDeleteConfirmId(null)
      refetch()
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.modifierForm.deletedFailed"), {
        description: error.message,
      })
    },
  })

  const resetForm = () => {
    setName("")
    setPriceAdjustment("")
    setIsAvailable(true)
    setEditingModifier(null)
  }

  const handleOpenCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleOpenEditDialog = (modifier: {
    id: number
    name: string
    priceAdjustment: number
    isAvailable: boolean
  }) => {
    setEditingModifier(modifier)
    setName(modifier.name)
    setPriceAdjustment((modifier.priceAdjustment / 100).toFixed(2))
    setIsAvailable(modifier.isAvailable)
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!name.trim()) {
      toast.error(t("menuManagement.modifierForm.validationError"))
      return
    }

    const priceAdjustmentValue = parseFloat(priceAdjustment)
    if (isNaN(priceAdjustmentValue)) {
      toast.error(t("menuManagement.modifierForm.validationError"))
      return
    }

    const priceInCents = Math.round(priceAdjustmentValue * 100)

    if (editingModifier) {
      // Update existing modifier
      updateModifier.mutate({
        id: editingModifier.id,
        name: name.trim(),
        priceAdjustment: priceInCents,
        isAvailable,
      })
    } else {
      // Create new modifier
      createModifier.mutate({
        name: name.trim(),
        priceAdjustment: priceInCents,
        isAvailable,
      })
    }
  }

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = () => {
    if (deleteConfirmId !== null) {
      deleteModifier.mutate(deleteConfirmId)
    }
  }

  const formatPrice = (priceInCents: number): string => {
    const value = priceInCents / 100
    if (value >= 0) {
      return `+$${value.toFixed(2)}`
    } else {
      return `-$${Math.abs(value).toFixed(2)}`
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{t("menuManagement.modifierForm.title")}</CardTitle>
          <Button onClick={handleOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t("menuManagement.addModifier")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded">
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-20" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !modifiers || (modifiers as any[]).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t("menuManagement.modifierForm.validationError")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("menuManagement.modifierForm.name")}</TableHead>
                <TableHead>{t("menuManagement.modifierForm.priceAdjustment")}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">{t("menuManagement.categoryForm.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(modifiers as any[]).map((modifier: any) => (
                <TableRow key={modifier.id}>
                  <TableCell className="font-medium">{modifier.name}</TableCell>
                  <TableCell>{formatPrice(modifier.priceAdjustment)}</TableCell>
                  <TableCell>
                    <Badge variant={modifier.isAvailable ? "default" : "secondary"}>
                      {modifier.isAvailable ? t("menuManagement.available") : t("menuManagement.unavailable")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditDialog(modifier)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(modifier.id)}>
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
                {editingModifier ? t("menuManagement.modifierForm.update") : t("menuManagement.modifierForm.create")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("menuManagement.modifierForm.name")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Extra Cheese"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">{t("menuManagement.modifierForm.priceAdjustment")} ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={priceAdjustment}
                  onChange={(e) => setPriceAdjustment(e.target.value)}
                  placeholder="e.g., 2.00 or -1.50"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Use positive values for upcharges, negative for discounts
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="available">{t("menuManagement.modifierForm.isAvailable")}</Label>
                <Switch id="available" checked={isAvailable} onCheckedChange={setIsAvailable} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t("menuManagement.modifierForm.cancel")}
              </Button>
              <Button type="submit" disabled={createModifier.isPending || updateModifier.isPending}>
                {editingModifier ? t("menuManagement.modifierForm.update") : t("menuManagement.modifierForm.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("menuManagement.modifierForm.deleteConfirm")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("menuManagement.modifierForm.deleteConfirmMessage")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t("menuManagement.modifierForm.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteModifier.isPending}
            >
              {t("menuManagement.modifierForm.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
