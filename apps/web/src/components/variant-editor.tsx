/**
 * T074: Variant Editor Component
 * Component for managing dish variants (sizes/options)
 * 
 * Features:
 * - Add/edit/delete variants
 * - Reorder by drag-and-drop
 * - Set price per variant
 * 
 * Props:
 * - dishId: number - The dish to manage variants for
 * - variants: DishVariant[] - Current variants
 * - onVariantsChange: () => void - Callback after variants change
 */

import { useMutation } from "@tanstack/react-query"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { queryClient, trpcClient } from "@/utils/trpc"

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface DishVariant {
  id: number
  name: string
  price: number
  displayOrder: number
}

interface VariantEditorProps {
  dishId: number
  variants: DishVariant[]
  onVariantsChange: () => void
}

interface SortableVariantItemProps {
  variant: DishVariant
  onEdit: (id: number, name: string, price: number) => void
  onDelete: (id: number) => void
}

function SortableVariantItem({ variant, onEdit, onDelete }: SortableVariantItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: variant.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(variant.name)
  const [price, setPrice] = useState((variant.price / 100).toString())

  const handleSave = () => {
    const priceInCents = Math.round(parseFloat(price) * 100)
    if (name && !isNaN(priceInCents) && priceInCents >= 0) {
      onEdit(variant.id, name, priceInCents)
      setIsEditing(false)
    } else {
      toast.error("Please provide valid name and price")
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border bg-card p-3"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      {isEditing ? (
        <>
          <div className="flex-1 space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Variant name (e.g., Small, Medium, Large)"
              className="text-sm"
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
              className="text-sm"
            />
          </div>
          <div className="flex gap-1">
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setName(variant.name)
                setPrice((variant.price / 100).toString())
                setIsEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1">
            <div className="font-medium">{variant.name}</div>
            <div className="text-sm text-muted-foreground">
              ${(variant.price / 100).toFixed(2)}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDelete(variant.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}

export function VariantEditor({ dishId, variants, onVariantsChange }: VariantEditorProps) {
  const [localVariants, setLocalVariants] = useState<DishVariant[]>(variants)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPrice, setNewPrice] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sync local state when props change
  useState(() => {
    setLocalVariants(variants)
  })

  const createVariantMutation = useMutation({
    mutationFn: async (data: { name: string; price: number; displayOrder: number }) => {
      return trpcClient.dishes.createVariant.mutate({
        dishId,
        name: data.name,
        price: data.price,
        displayOrder: data.displayOrder,
      })
    },
    onSuccess: () => {
      toast.success("Variant created successfully")
      queryClient.invalidateQueries({ queryKey: ["dishes", "listVariants"] })
      onVariantsChange()
      setIsAdding(false)
      setNewName("")
      setNewPrice("")
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create variant")
    },
  })

  const updateVariantMutation = useMutation({
    mutationFn: async (data: { variantId: number; name: string; price: number }) => {
      return trpcClient.dishes.updateVariant.mutate(data)
    },
    onSuccess: () => {
      toast.success("Variant updated successfully")
      queryClient.invalidateQueries({ queryKey: ["dishes", "listVariants"] })
      onVariantsChange()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update variant")
    },
  })

  const updateDisplayOrderMutation = useMutation({
    mutationFn: async (data: { variantId: number; displayOrder: number }) => {
      return trpcClient.dishes.updateVariant.mutate(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dishes", "listVariants"] })
      onVariantsChange()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reorder variants")
    },
  })

  const deleteVariantMutation = useMutation({
    mutationFn: async (variantId: number) => {
      return trpcClient.dishes.deleteVariant.mutate({ variantId })
    },
    onSuccess: () => {
      toast.success("Variant deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["dishes", "listVariants"] })
      onVariantsChange()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete variant")
    },
  })

  const handleAddVariant = () => {
    const priceInCents = Math.round(parseFloat(newPrice) * 100)
    if (!newName || isNaN(priceInCents) || priceInCents < 0) {
      toast.error("Please provide valid name and price")
      return
    }

    const displayOrder = localVariants.length
    createVariantMutation.mutate({ name: newName, price: priceInCents, displayOrder })
  }

  const handleEditVariant = (variantId: number, name: string, price: number) => {
    updateVariantMutation.mutate({ variantId, name, price })
  }

  const handleDeleteVariant = (variantId: number) => {
    if (confirm("Are you sure you want to delete this variant?")) {
      deleteVariantMutation.mutate(variantId)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setLocalVariants((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        const newItems = arrayMove(items, oldIndex, newIndex)

        // Update display order in backend
        newItems.forEach((item, index) => {
          if (item.displayOrder !== index) {
            updateDisplayOrderMutation.mutate({ variantId: item.id, displayOrder: index })
          }
        })

        return newItems
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dish Variants</CardTitle>
        <CardDescription>
          Manage size/option variants for this dish (e.g., Small, Medium, Large)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {localVariants.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No variants yet. Add a variant to allow customers to choose sizes or options.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={localVariants} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {localVariants.map((variant) => (
                  <SortableVariantItem
                    key={variant.id}
                    variant={variant}
                    onEdit={handleEditVariant}
                    onDelete={handleDeleteVariant}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {isAdding ? (
          <Card className="border-primary">
            <CardContent className="space-y-3 pt-4">
              <div className="space-y-2">
                <Label htmlFor="new-variant-name">Variant Name</Label>
                <Input
                  id="new-variant-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Small, Medium, Large"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-variant-price">Price ($)</Label>
                <Input
                  id="new-variant-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddVariant} disabled={createVariantMutation.isPending}>
                  {createVariantMutation.isPending ? "Creating..." : "Add Variant"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false)
                    setNewName("")
                    setNewPrice("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setIsAdding(true)} variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Variant
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
