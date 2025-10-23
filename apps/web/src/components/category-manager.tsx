import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Edit, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react"
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
 * T055 & T057: CategoryManager Component
 * Manager-only UI for creating, editing, and managing categories
 *
 * Features:
 * - List View: Table with Name, Display Order, Dish Count, Visibility, Actions
 * - Create Form: Modal with name, displayOrder, iconUrl
 * - Edit Form: Pre-populated modal for updating categories
 * - Toggle Visibility: Show/hide categories from customer view
 * - Display dish count for each category
 * - T057: Drag-and-drop reordering with @dnd-kit
 *
 * Dependencies: Backend categories router (T046-T051)
 */

interface CategoryFormData {
  name: string
  displayOrder: number
  iconUrl?: string | null
}

interface Category {
  id: number
  name: string
  displayOrder: number
  iconUrl: string | null
  isHidden: boolean
  dishCount: number
}

/**
 * T057: SortableRow Component for drag-and-drop
 */
function SortableRow({
  category,
  onEdit,
  onToggleVisibility,
  t,
}: {
  category: Category
  onEdit: (category: Category) => void
  onToggleVisibility: (id: number, currentIsHidden: boolean) => void
  t: any
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-[50px]">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {category.iconUrl && <span className="text-lg">{category.iconUrl}</span>}
          <span className="font-medium">{category.name}</span>
          {category.isHidden && (
            <Badge variant="secondary" className="ml-2">
              {t("menuManagement.categoryForm.hidden")}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">{category.displayOrder}</TableCell>
      <TableCell className="text-center">
        <Badge variant="outline">
          {t("menuManagement.categoryForm.dishCount", { count: category.dishCount })}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        {category.isHidden ? (
          <Badge variant="secondary">{t("menuManagement.hidden")}</Badge>
        ) : (
          <Badge variant="default">{t("menuManagement.visible")}</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleVisibility(category.id, category.isHidden)}
            title={category.isHidden ? t("menuManagement.showToCustomers") : t("menuManagement.hideFromCustomers")}
          >
            {category.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(category)}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function CategoryManager() {
  const { t } = useTranslation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<{
    id: number
    name: string
    displayOrder: number
    iconUrl: string | null
    isHidden: boolean
  } | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [displayOrder, setDisplayOrder] = useState("")
  const [iconUrl, setIconUrl] = useState("")

  // Query categories
  const {
    data: categories,
    isLoading,
    refetch,
  } = useQuery({
    ...trpc.categories.list.queryOptions({ visibleOnly: false }),
  })

  // Create mutation
  const createCategory = useMutation({
    mutationFn: (data: CategoryFormData) => trpcClient.categories.create.mutate(data),
    onSuccess: () => {
      toast.success(t("menuManagement.categoryForm.createdSuccess"))
      setIsDialogOpen(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.categoryForm.createdFailed"), {
        description: error.message,
      })
    },
  })

  // Update mutation
  const updateCategory = useMutation({
    mutationFn: (data: { id: number } & Partial<CategoryFormData>) =>
      trpcClient.categories.update.mutate(data),
    onSuccess: () => {
      toast.success(t("menuManagement.categoryForm.updatedSuccess"))
      setIsDialogOpen(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.categoryForm.updatedFailed"), {
        description: error.message,
      })
    },
  })

  // Toggle visibility mutation
  const toggleVisibility = useMutation({
    mutationFn: (data: { id: number; isHidden: boolean }) =>
      trpcClient.categories.toggleVisibility.mutate(data),
    onSuccess: () => {
      toast.success(t("menuManagement.categoryForm.updatedSuccess"))
      refetch()
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.categoryForm.updatedFailed"), {
        description: error.message,
      })
    },
  })

  // T057: Reorder mutation for drag-and-drop
  const reorderCategories = useMutation({
    mutationFn: (categoryOrders: Array<{ id: number; displayOrder: number }>) =>
      trpcClient.categories.reorder.mutate({ categoryOrders }),
    onSuccess: () => {
      toast.success(t("menuManagement.categoryForm.reorderSuccess"))
      refetch()
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.categoryForm.updatedFailed"), {
        description: error.message,
      })
    },
  })

  // T057: Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  )

  const resetForm = () => {
    setName("")
    setDisplayOrder("")
    setIconUrl("")
    setEditingCategory(null)
  }

  const handleOpenCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleOpenEditDialog = (category: {
    id: number
    name: string
    displayOrder: number
    iconUrl: string | null
    isHidden: boolean
  }) => {
    setEditingCategory(category)
    setName(category.name)
    setDisplayOrder(category.displayOrder.toString())
    setIconUrl(category.iconUrl || "")
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!name.trim()) {
      toast.error(t("menuManagement.categoryForm.validationError"))
      return
    }

    const displayOrderValue = parseInt(displayOrder) || 0

    const formData: CategoryFormData = {
      name: name.trim(),
      displayOrder: displayOrderValue,
      iconUrl: iconUrl.trim() || null,
    }

    if (editingCategory) {
      updateCategory.mutate({
        id: editingCategory.id,
        ...formData,
      })
    } else {
      createCategory.mutate(formData)
    }
  }

  const handleToggleVisibility = (id: number, currentIsHidden: boolean) => {
    toggleVisibility.mutate({
      id,
      isHidden: !currentIsHidden,
    })
  }

  // T057: Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id || !categories) {
      return
    }

    // Find the indices
    const oldIndex = (categories as any[]).findIndex((cat: any) => cat.id === active.id)
    const newIndex = (categories as any[]).findIndex((cat: any) => cat.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Create new order array
    const reorderedCategories = [...(categories as any[])]
    const [movedCategory] = reorderedCategories.splice(oldIndex, 1)
    reorderedCategories.splice(newIndex, 0, movedCategory)

    // Update displayOrder for all categories
    const categoryOrders = reorderedCategories.map((cat: any, index: number) => ({
      id: cat.id,
      displayOrder: index,
    }))

    // Call reorder mutation
    reorderCategories.mutate(categoryOrders)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("menuManagement.categoryForm.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-5 w-20" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t("menuManagement.categoryForm.title")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("menuManagement.categoryForm.description")}
            </p>
          </div>
          <Button onClick={handleOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t("menuManagement.categoryForm.create")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {categories && (categories as any[]).length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>{t("menuManagement.categoryForm.name")}</TableHead>
                  <TableHead className="text-center">{t("menuManagement.categoryForm.displayOrder")}</TableHead>
                  <TableHead className="text-center">{t("menuManagement.categoryForm.dishCount")}</TableHead>
                  <TableHead className="text-center">{t("menuManagement.categoryForm.status")}</TableHead>
                  <TableHead className="text-right">{t("menuManagement.categoryForm.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext
                items={(categories as any[]).map((cat: any) => cat.id)}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {(categories as any[]).map((category: any) => (
                    <SortableRow
                      key={category.id}
                      category={category}
                      onEdit={handleOpenEditDialog}
                      onToggleVisibility={handleToggleVisibility}
                      t={t}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </DndContext>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">{t("menuManagement.categoryForm.noCategories")}</p>
            <Button onClick={handleOpenCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("menuManagement.categoryForm.addFirst")}
            </Button>
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t("menuManagement.categoryForm.update") : t("menuManagement.categoryForm.create")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("menuManagement.categoryForm.categoryNameRequired")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("menuManagement.categoryForm.categoryNamePlaceholder")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayOrder">{t("menuManagement.categoryForm.displayOrderLabel")}</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder={t("menuManagement.categoryForm.displayOrderPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("menuManagement.categoryForm.displayOrderHint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="iconUrl">{t("menuManagement.categoryForm.iconLabel")}</Label>
                <Input
                  id="iconUrl"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder={t("menuManagement.categoryForm.iconPlaceholder")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t("menuManagement.categoryForm.cancel")}
              </Button>
              <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>
                {editingCategory ? t("menuManagement.categoryForm.update") : t("menuManagement.categoryForm.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
