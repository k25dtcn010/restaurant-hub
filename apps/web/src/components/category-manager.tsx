import { useMutation, useQuery } from "@tanstack/react-query"
import { Edit, Eye, EyeOff, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
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
 * T055: CategoryManager Component
 * Manager-only UI for creating, editing, and managing categories
 *
 * Features:
 * - List View: Table with Name, Display Order, Dish Count, Visibility, Actions
 * - Create Form: Modal with name, displayOrder, iconUrl
 * - Edit Form: Pre-populated modal for updating categories
 * - Toggle Visibility: Show/hide categories from customer view
 * - Display dish count for each category
 *
 * Dependencies: Backend categories router (T046-T051)
 */

interface CategoryFormData {
  name: string
  displayOrder: number
  iconUrl?: string | null
}

export function CategoryManager() {
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
      toast.success("Category created successfully")
      setIsDialogOpen(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast.error(`Failed to create category: ${error.message}`)
    },
  })

  // Update mutation
  const updateCategory = useMutation({
    mutationFn: (data: { id: number } & Partial<CategoryFormData>) =>
      trpcClient.categories.update.mutate(data),
    onSuccess: () => {
      toast.success("Category updated successfully")
      setIsDialogOpen(false)
      resetForm()
      refetch()
    },
    onError: (error: Error) => {
      toast.error(`Failed to update category: ${error.message}`)
    },
  })

  // Toggle visibility mutation
  const toggleVisibility = useMutation({
    mutationFn: (data: { id: number; isHidden: boolean }) =>
      trpcClient.categories.toggleVisibility.mutate(data),
    onSuccess: () => {
      toast.success("Category visibility updated")
      refetch()
    },
    onError: (error: Error) => {
      toast.error(`Failed to update visibility: ${error.message}`)
    },
  })

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
      toast.error("Name is required")
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Categories</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Organize menu items into categories
            </p>
          </div>
          <Button onClick={handleOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {categories && categories.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-center">Display Order</TableHead>
                <TableHead className="text-center">Dishes</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category: any) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {category.iconUrl && (
                        <span className="text-lg">{category.iconUrl}</span>
                      )}
                      <span className="font-medium">{category.name}</span>
                      {category.isHidden && (
                        <Badge variant="secondary" className="ml-2">
                          Hidden
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{category.displayOrder}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{category.dishCount} dishes</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {category.isHidden ? (
                      <Badge variant="secondary">Hidden</Badge>
                    ) : (
                      <Badge variant="default">Visible</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleVisibility(category.id, category.isHidden)}
                        title={category.isHidden ? "Show to customers" : "Hide from customers"}
                      >
                        {category.isHidden ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditDialog(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No categories found</p>
            <Button onClick={handleOpenCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Category
            </Button>
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Create New Category"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Appetizers, Main Course"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Categories are sorted by this number (lower numbers appear first)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="iconUrl">Icon (emoji or URL)</Label>
                <Input
                  id="iconUrl"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder="🍕 or https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCategory.isPending || updateCategory.isPending}
              >
                {editingCategory ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
