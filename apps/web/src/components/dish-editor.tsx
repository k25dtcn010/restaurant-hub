import { useState, useEffect } from "react";
import { trpc, trpcClient, queryClient } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
		id: number;
		name: string;
		description: string;
		price: number;
		photoUrl: string | null;
		isAvailable: boolean;
	} | null;
	onClose: (success: boolean) => void;
}

interface RecipeItem {
	ingredientId: number;
	quantityRequired: number;
}

export function DishEditor({ dish, onClose }: DishEditorProps) {
	const isEditing = dish !== null;

	// Form state
	const [name, setName] = useState(dish?.name || "");
	const [description, setDescription] = useState(dish?.description || "");
	const [price, setPrice] = useState(dish ? (dish.price / 100).toString() : "");
	const [photoUrl, setPhotoUrl] = useState(dish?.photoUrl || "");
	const [recipe, setRecipe] = useState<RecipeItem[]>([]);

	// Query ingredients for dropdown
	const { data: inventoryData } = useQuery({
		...trpc.inventory.getAll.queryOptions({
			includeRecipes: false,
		}),
	});

	// Load existing recipe for editing
	const { data: dishDetails } = useQuery({
		...trpc.dishes.getById.queryOptions({ dishId: dish?.id || 0 }),
		enabled: isEditing,
	});

	useEffect(() => {
		if (dishDetails?.recipe) {
			setRecipe(
				dishDetails.recipe.map((r: any) => ({
					ingredientId: r.ingredientId,
					quantityRequired: r.quantityRequired,
				}))
			);
		}
	}, [dishDetails]);

	// Mutations
	const createDish = useMutation({
		mutationFn: (variables: {
			name: string;
			description: string;
			price: number;
			photoUrl: string | null;
			recipe: RecipeItem[];
		}) => trpcClient.dishes.create.mutate(variables),
		onSuccess: () => {
			toast.success("Dish created successfully");
			onClose(true);
		},
		onError: (error: Error) => {
			toast.error(`Failed to create dish: ${error.message}`);
		},
	});

	const updateDish = useMutation({
		mutationFn: (variables: {
			dishId: number;
			name?: string;
			description?: string;
			price?: number;
			photoUrl?: string | null;
			recipe?: RecipeItem[];
		}) => trpcClient.dishes.update.mutate(variables),
		onSuccess: () => {
			toast.success("Dish updated successfully");
			onClose(true);
		},
		onError: (error: Error) => {
			toast.error(`Failed to update dish: ${error.message}`);
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Validation
		if (!name.trim()) {
			toast.error("Dish name is required");
			return;
		}
		if (!description.trim()) {
			toast.error("Description is required");
			return;
		}
		if (!price || parseFloat(price) <= 0) {
			toast.error("Valid price is required");
			return;
		}
		if (recipe.length === 0) {
			toast.error("At least one ingredient is required");
			return;
		}

		const priceInCents = Math.round(parseFloat(price) * 100);

		try {
			if (isEditing) {
				await updateDish.mutateAsync({
					dishId: dish.id,
					name,
					description,
					price: priceInCents,
					photoUrl: photoUrl || null,
					recipe,
				});
			} else {
				await createDish.mutateAsync({
					name,
					description,
					price: priceInCents,
					photoUrl: photoUrl || null,
					recipe,
				});
			}
		} catch (error) {
			// Error handled by mutation
		}
	};

	const handleAddRecipeItem = () => {
		const availableIngredients = inventoryData?.ingredients || [];
		if (availableIngredients.length === 0) {
			toast.error("No ingredients available. Please add ingredients first.");
			return;
		}

		// Add first available ingredient that's not already in recipe
		const usedIngredientIds = recipe.map((r) => r.ingredientId);
		const availableIngredient = availableIngredients.find(
			(ing: any) => !usedIngredientIds.includes(ing.id)
		);

		if (!availableIngredient) {
			toast.error("All ingredients are already in the recipe");
			return;
		}

		setRecipe([
			...recipe,
			{
				ingredientId: availableIngredient.id,
				quantityRequired: 1,
			},
		]);
	};

	const handleRemoveRecipeItem = (index: number) => {
		setRecipe(recipe.filter((_, i) => i !== index));
	};

	const handleRecipeChange = (
		index: number,
		field: keyof RecipeItem,
		value: number
	) => {
		const newRecipe = [...recipe];
		newRecipe[index] = { ...newRecipe[index], [field]: value };
		setRecipe(newRecipe);
	};

	const ingredients = inventoryData?.ingredients || [];

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>{isEditing ? "Edit Dish" : "Create New Dish"}</CardTitle>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => onClose(false)}
					>
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

						{/* Recipe */}
						<div className="space-y-2">
							<div className="flex justify-between items-center">
								<Label>Recipe *</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleAddRecipeItem}
								>
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
									const ingredient = ingredients.find(
										(ing: any) => ing.id === item.ingredientId
									);
									return (
										<div key={index} className="flex gap-2 items-end">
											<div className="flex-1">
												<Label className="text-xs">Ingredient</Label>
												<select
													value={item.ingredientId}
													onChange={(e) =>
														handleRecipeChange(
															index,
															"ingredientId",
															parseInt(e.target.value)
														)
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
												<Label className="text-xs">
													Quantity ({ingredient?.unit || "unit"})
												</Label>
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
									);
								})}
							</div>
						</div>
					</CardContent>
					<CardFooter className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onClose(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={createDish.isPending || updateDish.isPending}
						>
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
	);
}
