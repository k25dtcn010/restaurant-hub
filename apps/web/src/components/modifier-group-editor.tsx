import { useMutation, useQuery } from "@tanstack/react-query"
import { Edit, GripVertical, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
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
      toast.success("Modifier group created successfully")
      setIsDialogOpen(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast.error(`Failed to create group: ${error.message}`)
    },
  })

  // Update mutation
  const updateGroup = useMutation({
    mutationFn: (data: { id: number } & Partial<ModifierGroupFormData>) =>
      trpcClient.modifiers.updateGroup.mutate(data),
    onSuccess: () => {
      toast.success("Modifier group updated successfully")
      setIsDialogOpen(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast.error(`Failed to update group: ${error.message}`)
    },
  })

  // Delete mutation
  const deleteGroup = useMutation({
    mutationFn: (id: number) => trpcClient.modifiers.deleteGroup.mutate({ id }),
    onSuccess: () => {
      toast.success("Modifier group deleted successfully")
      setDeleteConfirmId(null)
      refetch()
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete group: ${error.message}`)
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
    const nextOrder = groups ? groups.length + 1 : 1
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
      toast.error("Name is required")
      return
    }

    const min = minSelections ? parseInt(minSelections) : undefined
    const max = maxSelections ? parseInt(maxSelections) : undefined
    const order = parseInt(displayOrder)

    if (isNaN(order) || order < 0) {
      toast.error("Display order must be a non-negative number")
      return
    }

    if (min !== undefined && isNaN(min)) {
      toast.error("Min selections must be a valid number")
      return
    }

    if (max !== undefined && isNaN(max)) {
      toast.error("Max selections must be a valid number")
      return
    }

    // Validate min <= max
    if (min !== undefined && max !== undefined && min > max) {
      toast.error("Min selections cannot be greater than max selections")
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
      return "No limits"
    }
    if (min != null && max != null) {
      return `${min}-${max}`
    }
    if (min != null) {
      return `Min: ${min}`
    }
    return `Max: ${max}`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Modifier Groups</CardTitle>
          <Button onClick={handleOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading groups...</div>
        ) : !groups || groups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No modifier groups found. Create your first group to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Selection Limits</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
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
                {editingGroup ? "Edit Modifier Group" : "Create Modifier Group"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Toppings, Size"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="minSelections">Min Selections (optional)</Label>
                <Input
                  id="minSelections"
                  type="number"
                  min="0"
                  value={minSelections}
                  onChange={(e) => setMinSelections(e.target.value)}
                  placeholder="Leave empty for no minimum"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxSelections">Max Selections (optional)</Label>
                <Input
                  id="maxSelections"
                  type="number"
                  min="0"
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(e.target.value)}
                  placeholder="Leave empty for no maximum"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  min="0"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder="e.g., 1, 2, 3"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Groups will be displayed in ascending order
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createGroup.isPending || updateGroup.isPending}>
                {editingGroup ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Modifier Group</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this modifier group? This action cannot be undone. If
            the group is assigned to dishes, the deletion will fail.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteGroup.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
