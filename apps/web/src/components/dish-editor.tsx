import { useMutation, useQuery } from "@tanstack/react-query"
import { Plus, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
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
    if ((dishDetails as any)?.recipe) {
      setRecipe(
        ((dishDetails as any).recipe as any[]).map((r: any) => ({
          ingredientId: r.ingredientId,
          quantityRequired: r.quantityRequired,
        }))
      )
    }
    // T075: Set hasVariants based on existing variants
    if (
      (dishDetails as any)?.variants &&
      Array.isArray((dishDetails as any).variants) &&
      ((dishDetails as any).variants as any[]).length > 0
    ) {
      setHasVariants(true)
    }
  }, [dishDetails])

  // Load existing modifier assignments
  useEffect(() => {
    const modList = dishModifiers as any
    if (modList && Array.isArray(modList) && modList.length > 0) {
      const modifiersArray: SelectedModifier[] = []
      modList.forEach((group: any) => {
        if (group.modifiers && Array.isArray(group.modifiers)) {
          group.modifiers.forEach((modifier: any) => {
            modifiersArray.push({
              modifierId: modifier.id,
              modifierGroupId: group.group.id,
            })
          })
        }
      })
      setSelectedModifiers(modifiersArray)
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
    onSuccess: async (data: any) => {
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
      toast.success(t("menuManagement.dishForm.createdSuccess"))
      onClose(true)
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.dishForm.createdFailed"), {
        description: error.message,
      })
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
      toast.success(t("menuManagement.dishForm.updatedSuccess"))
      onClose(true)
    },
    onError: (error: Error) => {
      toast.error(t("menuManagement.dishForm.updatedFailed"), {
        description: error.message,
      })
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!name.trim()) {
      toast.error(t("menuManagement.dishForm.validationError"))
      return
    }
    if (!description.trim()) {
      toast.error(t("menuManagement.dishForm.validationError"))
      return
    }
    if (!price || parseFloat(price) <= 0) {
      toast.error(t("menuManagement.dishForm.priceError"))
      return
    }
    if (recipe.length === 0) {
      toast.error(t("menuManagement.dishForm.validationError"))
      return
    }

    const priceInCents = Math.round(parseFloat(price) * 100)

    // Parse order priority (T059)
    const priorityValue = parseInt(orderPriority) || 0
    if (priorityValue < 0 || priorityValue > 100) {
      toast.error(t("menuManagement.dishForm.validationError"))
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
    const availableIngredients = (inventoryData as any)?.ingredients || []
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

  const ingredients = (inventoryData as any)?.ingredients || []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEditing ? t("menuManagement.dishForm.editTitle") : t("menuManagement.dishForm.newTitle")}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => onClose(false)}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t("menuManagement.dishForm.dishNameRequired")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("menuManagement.dishForm.dishNamePlaceholder")}
                maxLength={100}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t("menuManagement.dishForm.descriptionRequired")}</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("menuManagement.dishForm.descriptionPlaceholder")}
                maxLength={500}
                required
                className="w-full min-h-[100px] px-3 py-2 border border-input bg-background rounded-md"
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price">{t("menuManagement.dishForm.priceRequired")}</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t("menuManagement.dishForm.pricePlaceholder")}
                required
              />
            </div>

            {/* Photo URL */}
            <div className="space-y-2">
              <Label htmlFor="photoUrl">{t("menuManagement.dishForm.photoUrlOptional")}</Label>
              <Input
                id="photoUrl"
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder={t("menuManagement.dishForm.photoUrlPlaceholder")}
              />
            </div>

            {/* T059: Dish Flags */}
            <div className="space-y-4 border rounded-md p-4">
              <Label className="text-base font-semibold">{t("menuManagement.dishForm.dishFlagsAndPriority")}</Label>

              {/* Recommended Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isRecommended" className="cursor-pointer">
                    {t("menuManagement.dishForm.recommendedLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("menuManagement.dishForm.recommendedDesc")}</p>
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
                    {t("menuManagement.dishForm.chefSpecialLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("menuManagement.dishForm.chefSpecialDesc")}</p>
                </div>
                <Checkbox
                  id="isChefSpecial"
                  checked={isChefSpecial}
                  onCheckedChange={(checked) => setIsChefSpecial(checked as boolean)}
                />
              </div>

              {/* Order Priority */}
              <div className="space-y-2">
                <Label htmlFor="orderPriority">{t("menuManagement.dishForm.kitchenPriorityLabel")}</Label>
                <Input
                  id="orderPriority"
                  type="number"
                  min="0"
                  max="100"
                  value={orderPriority}
                  onChange={(e) => setOrderPriority(e.target.value)}
                  placeholder={t("menuManagement.dishForm.kitchenPriorityPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("menuManagement.dishForm.kitchenPriorityDesc")}
                </p>
              </div>
            </div>

            {/* Recipe */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>{t("menuManagement.dishForm.recipeRequired")}</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddRecipeItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("menuManagement.dishForm.addRecipeItem")}
                </Button>
              </div>

              {recipe.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("menuManagement.dishForm.recipeEmpty")}
                </p>
              )}

              <div className="space-y-2">
                {recipe.map((item, index) => {
                  const ingredient = ingredients.find((ing: any) => ing.id === item.ingredientId)
                  return (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">{t("menuManagement.dishForm.ingredient")}</Label>
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
                        <Label className="text-xs">{t("menuManagement.dishForm.quantityLabel", { unit: ingredient?.unit || "unit" })}</Label>
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
              <Label>{t("menuManagement.dishForm.categories")}</Label>
              {!(allCategories as any) || (allCategories as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("menuManagement.dishForm.noCategoriesAvailable")}
                </p>
              ) : (
                <div className="border rounded-md p-4">
                  <div className="grid grid-cols-2 gap-2">
                    {((allCategories as any[]) || []).map((category: any) => (
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
              <Label>{t("menuManagement.dishForm.availableModifiers")}</Label>
              {!(modifierGroups as any) || (modifierGroups as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("menuManagement.dishForm.noModifierGroupsAvailable")}
                </p>
              ) : (
                <div className="space-y-4 border rounded-md p-4">
                  {((modifierGroups as any[]) || []).map((group: any) => {
                    const groupModifiers =
                      (allModifiers as any)?.filter(
                        (mod: any) =>
                          (dishModifiers as any)
                            ?.find((dg: any) => dg.group?.id === group.id)
                            ?.modifiers?.some((m: any) => m.id === mod.id) ||
                          selectedModifiers.some((sm) => sm.modifierGroupId === group.id)
                      ) || []

                    const availableModifiersForGroup =
                      (allModifiers as any)?.filter((mod: any) =>
                        selectedModifiers.some(
                          (sm) => sm.modifierId === mod.id && sm.modifierGroupId === group.id
                        )
                      ) || []

                    return (
                      <div key={group.id} className="space-y-2">
                        <div className="font-medium text-sm">{group.name}</div>
                        <div className="grid grid-cols-2 gap-2 pl-4">
                          {((allModifiers as any) || []).map((modifier: any) => (
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
                  <Label htmlFor="has-variants">{t("menuManagement.dishForm.hasVariants")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("menuManagement.dishForm.hasVariantsDesc")}
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
                  variants={(variantsData as any)?.variants || []}
                  onVariantsChange={() => {
                    refetchVariants()
                    queryClient.invalidateQueries({ queryKey: ["dishes", "getById"] })
                  }}
                />
              )}

              {hasVariants && !isEditing && (
                <p className="text-sm text-muted-foreground border rounded-md p-4">
                  {t("menuManagement.dishForm.variantsSaveFirst")}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              {t("menuManagement.dishForm.cancel")}
            </Button>
            <Button type="submit" disabled={createDish.isPending || updateDish.isPending}>
              {createDish.isPending || updateDish.isPending
                ? t("menuManagement.dishForm.savingText")
                : isEditing
                  ? t("menuManagement.dishForm.updateDishButton")
                  : t("menuManagement.dishForm.createDishButton")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
