import { useMutation, useQuery } from "@tanstack/react-query"
import { Plus, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { VariantEditor } from "@/components/variant-editor"
import { queryClient, trpc, trpcClient } from "@/utils/trpc"

/**
 * T130: DishEditor Component
 * Component for creating and editing dishes with recipes
 *
 * Data Model: data-model.md Dish Section
 * Features:
 * - Create new dishes with recipes
 * - Edit existing dish details
 * - Manage ingredient requirements
 */

interface DishEditorProps {
  dish: {
    id: number
    name: string
    description: string
    price: number
    photoUrl: string | null
    isAvailable: boolean
    isRecommended?: boolean
    isChefSpecial?: boolean
    orderPriority?: number
  } | null
  onClose: (success: boolean) => void
}

interface RecipeItem {
  ingredientId: number
  quantityRequired: number
}

interface SelectedModifier {
  modifierId: number
  modifierGroupId: number
}

export function DishEditor({ dish, onClose }: DishEditorProps) {
  const isEditing = dish !== null

  // Form state
  const [name, setName] = useState(dish?.name || "")
  const [description, setDescription] = useState(dish?.description || "")
  const [price, setPrice] = useState(dish ? (dish.price / 100).toString() : "")
  const [photoUrl, setPhotoUrl] = useState(dish?.photoUrl || "")
  const [recipe, setRecipe] = useState<RecipeItem[]>([])
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([])

  // T059: Flag fields
  const [isRecommended, setIsRecommended] = useState(dish?.isRecommended || false)
  const [isChefSpecial, setIsChefSpecial] = useState(dish?.isChefSpecial || false)
  const [orderPriority, setOrderPriority] = useState(
    dish?.orderPriority !== undefined ? dish.orderPriority.toString() : "0"
  )

  // T058: Category assignment
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])

  // T075: Variant toggle
  const [hasVariants, setHasVariants] = useState(false)

  // Query ingredients for dropdown
  const { data: inventoryData } = useQuery({
    ...trpc.inventory.getAll.queryOptions({
      includeRecipes: false,
    }),
  })

  // Query modifier groups and modifiers
  const { data: modifierGroups } = useQuery({
    ...trpc.modifiers.listGroups.queryOptions(),
  })

  const { data: allModifiers } = useQuery({
    ...trpc.modifiers.list.queryOptions({ availableOnly: false }),
  })

  // T058: Query all categories for assignment
  const { data: allCategories } = useQuery({
    ...trpc.categories.list.queryOptions({ visibleOnly: false }),
  })

  // T058: Query current dish's categories when editing
  const { data: dishCategories } = useQuery({
    ...trpc.categories.listDishes.queryOptions({ categoryId: 0 }), // Will be filtered client-side
    enabled: false, // We'll use a different approach
  })

  // Load existing modifiers for editing
  const { data: dishModifiers } = useQuery({
    ...trpc.modifiers.getByDish.queryOptions({ dishId: dish?.id || 0 }),
    enabled: isEditing,
  })

  // Load existing recipe for editing
  const { data: dishDetails } = useQuery({
    ...trpc.dishes.getById.queryOptions({ dishId: dish?.id || 0 }),
    enabled: isEditing,
  })

  // T076: Load existing variants for editing
  const { data: variantsData, refetch: refetchVariants } = useQuery({
    ...trpc.dishes.listVariants.queryOptions({ dishId: dish?.id || 0 }),
    enabled: isEditing,
  })

  useEffect(() => {
    if (dishDetails?.recipe) {
      setRecipe(
        dishDetails.recipe.map((r: any) => ({
          ingredientId: r.ingredientId,
          quantityRequired: r.quantityRequired,
        }))
      )
    }
    // T075: Set hasVariants based on existing variants
    if (
      dishDetails?.variants &&
      Array.isArray(dishDetails.variants) &&
      dishDetails.variants.length > 0
    ) {
      setHasVariants(true)
    }
  }, [dishDetails])

  // Load existing modifier assignments
  useEffect(() => {
    if (dishModifiers && dishModifiers.length > 0) {
      const modifiers: SelectedModifier[] = []
      dishModifiers.forEach((group: any) => {
        group.modifiers.forEach((modifier: any) => {
          modifiers.push({
            modifierId: modifier.id,
            modifierGroupId: group.group.id,
          })
        })
      })
      setSelectedModifiers(modifiers)
    }
  }, [dishModifiers])

  // Mutations
  const createDish = useMutation({
    mutationFn: (variables: {
      name: string
      description: string
      price: number
      photoUrl: string | null
      recipe: RecipeItem[]
    }) => trpcClient.dishes.create.mutate(variables),
    onSuccess: async (data) => {
      // T058: Assign categories after dish creation
      if (selectedCategories.length > 0) {
        try {
          await trpcClient.categories.assignDishes.mutate({
            categoryId: selectedCategories[0], // Note: API takes one category at a time
            dishIds: [data.dishId],
          })
          // Assign to additional categories
          for (let i = 1; i < selectedCategories.length; i++) {
            await trpcClient.categories.assignDishes.mutate({
              categoryId: selectedCategories[i],
              dishIds: [data.dishId],
            })
          }
        } catch (error) {
          console.error("Error assigning categories:", error)
        }
      }

      // Assign modifiers after dish creation
      if (selectedModifiers.length > 0) {
        for (const modifier of selectedModifiers) {
          await trpcClient.modifiers.assignToDish.mutate({
            dishId: data.dishId,
            modifierId: modifier.modifierId,
            modifierGroupId: modifier.modifierGroupId,
          })
        }
      }
      toast.success("Dish created successfully")
      onClose(true)
    },
    onError: (error: Error) => {
      toast.error(`Failed to create dish: ${error.message}`)
    },
  })

  const updateDish = useMutation({
    mutationFn: (variables: {
      dishId: number
      name?: string
      description?: string
      price?: number
      photoUrl?: string | null
      recipe?: RecipeItem[]
    }) => trpcClient.dishes.update.mutate(variables),
    onSuccess: async () => {
      // T058: Assign categories after dish update
      if (dish && selectedCategories.length > 0) {
        for (const categoryId of selectedCategories) {
          try {
            await trpcClient.categories.assignDishes.mutate({
              categoryId,
              dishIds: [dish.id],
            })
          } catch (error) {
            // Ignore errors for already assigned categories
          }
        }
      }

      // Note: Modifier assignments are updated separately for now
      // In a full implementation, we would diff and update assignments
      if (dish && selectedModifiers.length > 0) {
        for (const modifier of selectedModifiers) {
          try {
            await trpcClient.modifiers.assignToDish.mutate({
              dishId: dish.id,
              modifierId: modifier.modifierId,
              modifierGroupId: modifier.modifierGroupId,
            })
          } catch (error) {
            // Ignore duplicate assignment errors
          }
        }
      }
      toast.success("Dish updated successfully")
      onClose(true)
    },
    onError: (error: Error) => {
      toast.error(`Failed to update dish: ${error.message}`)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!name.trim()) {
      toast.error("Dish name is required")
      return
    }
    if (!description.trim()) {
      toast.error("Description is required")
      return
    }
    if (!price || parseFloat(price) <= 0) {
      toast.error("Valid price is required")
      return
    }
    if (recipe.length === 0) {
      toast.error("At least one ingredient is required")
      return
    }

    const priceInCents = Math.round(parseFloat(price) * 100)

    // Parse order priority (T059)
    const priorityValue = parseInt(orderPriority) || 0
    if (priorityValue < 0 || priorityValue > 100) {
      toast.error("Order priority must be between 0 and 100")
      return
    }

    try {
      if (isEditing) {
        await updateDish.mutateAsync({
          dishId: dish.id,
          name,
          description,
          price: priceInCents,
          photoUrl: photoUrl || null,
          recipe,
          isRecommended,
          isChefSpecial,
          orderPriority: priorityValue,
        } as any)
      } else {
        await createDish.mutateAsync({
          name,
          description,
          price: priceInCents,
          photoUrl: photoUrl || null,
          recipe,
          isRecommended,
          isChefSpecial,
          orderPriority: priorityValue,
        } as any)
      }
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleAddRecipeItem = () => {
    const availableIngredients = inventoryData?.ingredients || []
    if (availableIngredients.length === 0) {
      toast.error("No ingredients available. Please add ingredients first.")
      return
    }

    // Add first available ingredient that's not already in recipe
    const usedIngredientIds = recipe.map((r) => r.ingredientId)
    const availableIngredient = availableIngredients.find(
      (ing: any) => !usedIngredientIds.includes(ing.id)
    )

    if (!availableIngredient) {
      toast.error("All ingredients are already in the recipe")
      return
    }

    setRecipe([
      ...recipe,
      {
        ingredientId: availableIngredient.id,
        quantityRequired: 1,
      },
    ])
  }

  const handleRemoveRecipeItem = (index: number) => {
    setRecipe(recipe.filter((_, i) => i !== index))
  }

  const handleRecipeChange = (index: number, field: keyof RecipeItem, value: number) => {
    const newRecipe = [...recipe]
    newRecipe[index] = { ...newRecipe[index], [field]: value }
    setRecipe(newRecipe)
  }

  const handleModifierToggle = (modifierId: number, modifierGroupId: number, checked: boolean) => {
    if (checked) {
      setSelectedModifiers([...selectedModifiers, { modifierId, modifierGroupId }])
    } else {
      setSelectedModifiers(
        selectedModifiers.filter(
          (m) => !(m.modifierId === modifierId && m.modifierGroupId === modifierGroupId)
        )
      )
    }
  }

  const isModifierSelected = (modifierId: number, modifierGroupId: number): boolean => {
    return selectedModifiers.some(
      (m) => m.modifierId === modifierId && m.modifierGroupId === modifierGroupId
    )
  }

  const ingredients = inventoryData?.ingredients || []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEditing ? "Edit Dish" : "Create New Dish"}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => onClose(false)}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Dish Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Margherita Pizza"
                maxLength={100}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the dish..."
                maxLength={500}
                required
                className="w-full min-h-[100px] px-3 py-2 border border-input bg-background rounded-md"
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price">Price ($) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="15.00"
                required
              />
            </div>

            {/* Photo URL */}
            <div className="space-y-2">
              <Label htmlFor="photoUrl">Photo URL (optional)</Label>
              <Input
                id="photoUrl"
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://example.com/dish.jpg"
              />
            </div>

            {/* T059: Dish Flags */}
            <div className="space-y-4 border rounded-md p-4">
              <Label className="text-base font-semibold">Dish Flags & Priority</Label>

              {/* Recommended Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isRecommended" className="cursor-pointer">
                    Recommended 👍
                  </Label>
                  <p className="text-xs text-muted-foreground">Show thumbs-up badge to customers</p>
                </div>
                <Checkbox
                  id="isRecommended"
                  checked={isRecommended}
                  onCheckedChange={(checked) => setIsRecommended(checked as boolean)}
                />
              </div>

              {/* Chef's Special Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isChefSpecial" className="cursor-pointer">
                    Chef's Special ⭐
                  </Label>
                  <p className="text-xs text-muted-foreground">Show star badge to customers</p>
                </div>
                <Checkbox
                  id="isChefSpecial"
                  checked={isChefSpecial}
                  onCheckedChange={(checked) => setIsChefSpecial(checked as boolean)}
                />
              </div>

              {/* Order Priority */}
              <div className="space-y-2">
                <Label htmlFor="orderPriority">Kitchen Priority (0-100)</Label>
                <Input
                  id="orderPriority"
                  type="number"
                  min="0"
                  max="100"
                  value={orderPriority}
                  onChange={(e) => setOrderPriority(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Higher priority dishes appear first in kitchen queue (0 = normal, 100 = highest)
                </p>
              </div>
            </div>

            {/* Recipe */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Recipe *</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddRecipeItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ingredient
                </Button>
              </div>

              {recipe.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No ingredients added yet. Click "Add Ingredient" to start.
                </p>
              )}

              <div className="space-y-2">
                {recipe.map((item, index) => {
                  const ingredient = ingredients.find((ing: any) => ing.id === item.ingredientId)
                  return (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">Ingredient</Label>
                        <select
                          value={item.ingredientId}
                          onChange={(e) =>
                            handleRecipeChange(index, "ingredientId", parseInt(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-input bg-background rounded-md"
                        >
                          {ingredients.map((ing: any) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} ({ing.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-32">
                        <Label className="text-xs">Quantity ({ingredient?.unit || "unit"})</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={item.quantityRequired}
                          onChange={(e) =>
                            handleRecipeChange(
                              index,
                              "quantityRequired",
                              parseFloat(e.target.value)
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRemoveRecipeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* T058: Category Assignment */}
            <div className="space-y-2">
              <Label>Categories</Label>
              {!allCategories || allCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No categories available. Create categories in the Categories tab first.
                </p>
              ) : (
                <div className="border rounded-md p-4">
                  <div className="grid grid-cols-2 gap-2">
                    {allCategories.map((category: any) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category.id}`}
                          checked={selectedCategories.includes(category.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCategories([...selectedCategories, category.id])
                            } else {
                              setSelectedCategories(
                                selectedCategories.filter((id) => id !== category.id)
                              )
                            }
                          }}
                        />
                        <label
                          htmlFor={`category-${category.id}`}
                          className="text-sm cursor-pointer flex items-center gap-1"
                        >
                          {category.iconUrl && <span>{category.iconUrl}</span>}
                          {category.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modifier Assignment */}
            <div className="space-y-2">
              <Label>Available Modifiers</Label>
              {!modifierGroups || modifierGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No modifier groups available. Create modifier groups in the Modifiers tab first.
                </p>
              ) : (
                <div className="space-y-4 border rounded-md p-4">
                  {modifierGroups.map((group: any) => {
                    const groupModifiers =
                      allModifiers?.filter(
                        (mod: any) =>
                          dishModifiers
                            ?.find((dg: any) => dg.group?.id === group.id)
                            ?.modifiers?.some((m: any) => m.id === mod.id) ||
                          selectedModifiers.some((sm) => sm.modifierGroupId === group.id)
                      ) || []

                    const availableModifiersForGroup =
                      allModifiers?.filter((mod: any) =>
                        selectedModifiers.some(
                          (sm) => sm.modifierId === mod.id && sm.modifierGroupId === group.id
                        )
                      ) || []

                    return (
                      <div key={group.id} className="space-y-2">
                        <div className="font-medium text-sm">{group.name}</div>
                        <div className="grid grid-cols-2 gap-2 pl-4">
                          {allModifiers?.map((modifier: any) => (
                            <div key={modifier.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`modifier-${group.id}-${modifier.id}`}
                                checked={isModifierSelected(modifier.id, group.id)}
                                onCheckedChange={(checked) =>
                                  handleModifierToggle(modifier.id, group.id, checked as boolean)
                                }
                              />
                              <label
                                htmlFor={`modifier-${group.id}-${modifier.id}`}
                                className="text-sm cursor-pointer"
                              >
                                {modifier.name}
                                {modifier.priceAdjustment !== 0 && (
                                  <span className="text-muted-foreground ml-1">
                                    ({modifier.priceAdjustment > 0 ? "+" : ""}$
                                    {(modifier.priceAdjustment / 100).toFixed(2)})
                                  </span>
                                )}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* T075 & T076: Variant Management */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="has-variants">Has Variants</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable size/option variants (e.g., Small, Medium, Large)
                  </p>
                </div>
                <Switch
                  id="has-variants"
                  checked={hasVariants}
                  onCheckedChange={setHasVariants}
                  disabled={!isEditing}
                />
              </div>

              {/* T076: Show variant editor if enabled and dish is saved */}
              {hasVariants && isEditing && dish && (
                <VariantEditor
                  dishId={dish.id}
                  variants={variantsData?.variants || []}
                  onVariantsChange={() => {
                    refetchVariants()
                    queryClient.invalidateQueries({ queryKey: ["dishes", "getById"] })
                  }}
                />
              )}

              {hasVariants && !isEditing && (
                <p className="text-sm text-muted-foreground border rounded-md p-4">
                  Save this dish first to manage variants. Variants can only be added to existing
                  dishes.
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDish.isPending || updateDish.isPending}>
              {createDish.isPending || updateDish.isPending
                ? "Saving..."
                : isEditing
                  ? "Update Dish"
                  : "Create Dish"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
