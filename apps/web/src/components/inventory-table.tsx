import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import { IngredientRow } from "./ingredient-row";

/**
 * T105: InventoryTable Component
 * Displays all ingredients in a table format
 * 
 * Acceptance: spec.md US5 Scenario 1
 * - Shows all ingredients with quantities, units, and thresholds
 * 
 * Contract: inventory-router.md Procedure 1 Output
 */

export interface IngredientData {
	id: number;
	name: string;
	quantity: number;
	unit: string;
	threshold: number;
	isLowStock: boolean;
	updatedAt: string | Date;
	usedInDishes?: Array<{
		dishId: number;
		dishName: string;
		quantityRequired: number;
	}>;
}

interface InventoryTableProps {
	ingredients: IngredientData[];
}

export function InventoryTable({ ingredients }: InventoryTableProps) {
	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[40%]">Ingredient</TableHead>
						<TableHead className="text-right">Current Stock</TableHead>
						<TableHead className="text-right">Threshold</TableHead>
						<TableHead className="text-right">Status</TableHead>
						<TableHead className="w-[140px]">Used In</TableHead>
						<TableHead className="w-[100px] text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{ingredients.map((ingredient) => (
						<IngredientRow key={ingredient.id} ingredient={ingredient} />
					))}
				</TableBody>
			</Table>
		</div>
	);
}
