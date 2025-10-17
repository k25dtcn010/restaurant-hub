// IMPORTANT: Load environment variables BEFORE importing db
import dotenv from "dotenv";
dotenv.config({ path: "../../apps/server/.env" });

import type {
	UserInsert,
	TableInsert,
	IngredientInsert,
	DishInsert,
	RecipeInsert,
} from "./index";

/**
 * Database seed script per data-model.md Seed Data Requirements
 * Creates initial test data for development and testing
 */
async function seed() {
	console.log("🌱 Starting database seed...");
	console.log(`📁 Database URL: ${process.env.DATABASE_URL}`);

	// Dynamic import after env is loaded
	const { db, user, tables, ingredients, dishes, recipes } = await import(
		"./index"
	);

	// 1. Create 3 test users (one per role)
	console.log("Creating test users...");
	const users: UserInsert[] = [
		{
			id: "manager-001",
			email: "admin@restauranthub.com",
			name: "Admin Manager",
			role: "Manager",
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "chef-001",
			email: "chef@restauranthub.com",
			name: "Head Chef",
			role: "KitchenStaff",
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "waiter-001",
			email: "waiter@restauranthub.com",
			name: "Friendly Waiter",
			role: "Waiter",
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	await db.insert(user).values(users);
	console.log("✓ Created 3 test users");

	// 2. Create 30 tables with QR codes
	console.log("Creating tables...");
	const tablesData: TableInsert[] = [];
	for (let i = 1; i <= 30; i++) {
		const capacity = [2, 2, 4, 4, 4, 6, 6][Math.floor(Math.random() * 7)]; // Randomize capacity
		tablesData.push({
			number: i,
			qrCode: `https://app.restauranthub.com/?table=${i}`,
			capacity,
			createdAt: new Date(),
		});
	}
	await db.insert(tables).values(tablesData);
	console.log("✓ Created 30 tables with QR codes");

	// 3. Create ~20 common ingredients
	console.log("Creating ingredients...");
	const ingredientsData: IngredientInsert[] = [
		{
			name: "Beef Patty",
			quantity: 100,
			unit: "pieces",
			threshold: 15,
			updatedAt: new Date(),
		},
		{
			name: "Lettuce",
			quantity: 50,
			unit: "kg",
			threshold: 10,
			updatedAt: new Date(),
		},
		{
			name: "Tomato",
			quantity: 50,
			unit: "kg",
			threshold: 10,
			updatedAt: new Date(),
		},
		{
			name: "Cheese Slices",
			quantity: 150,
			unit: "pieces",
			threshold: 20,
			updatedAt: new Date(),
		},
		{
			name: "Burger Buns",
			quantity: 120,
			unit: "pieces",
			threshold: 20,
			updatedAt: new Date(),
		},
		{
			name: "Chicken Breast",
			quantity: 80,
			unit: "pieces",
			threshold: 15,
			updatedAt: new Date(),
		},
		{
			name: "Rice",
			quantity: 100,
			unit: "kg",
			threshold: 15,
			updatedAt: new Date(),
		},
		{
			name: "Pasta",
			quantity: 80,
			unit: "kg",
			threshold: 15,
			updatedAt: new Date(),
		},
		{
			name: "Tomato Sauce",
			quantity: 60,
			unit: "L",
			threshold: 10,
			updatedAt: new Date(),
		},
		{
			name: "Olive Oil",
			quantity: 40,
			unit: "L",
			threshold: 5,
			updatedAt: new Date(),
		},
		{
			name: "Bacon",
			quantity: 60,
			unit: "pieces",
			threshold: 10,
			updatedAt: new Date(),
		},
		{
			name: "Onions",
			quantity: 30,
			unit: "kg",
			threshold: 5,
			updatedAt: new Date(),
		},
		{
			name: "Garlic",
			quantity: 20,
			unit: "kg",
			threshold: 3,
			updatedAt: new Date(),
		},
		{
			name: "Parmesan",
			quantity: 40,
			unit: "kg",
			threshold: 5,
			updatedAt: new Date(),
		},
		{
			name: "Cream",
			quantity: 35,
			unit: "L",
			threshold: 5,
			updatedAt: new Date(),
		},
		{
			name: "Black Pepper",
			quantity: 10,
			unit: "kg",
			threshold: 2,
			updatedAt: new Date(),
		},
		{
			name: "Salt",
			quantity: 20,
			unit: "kg",
			threshold: 3,
			updatedAt: new Date(),
		},
		{
			name: "Mushrooms",
			quantity: 25,
			unit: "kg",
			threshold: 5,
			updatedAt: new Date(),
		},
		{
			name: "Bell Peppers",
			quantity: 30,
			unit: "kg",
			threshold: 5,
			updatedAt: new Date(),
		},
		{
			name: "Caesar Dressing",
			quantity: 20,
			unit: "L",
			threshold: 3,
			updatedAt: new Date(),
		},
	];
	const insertedIngredients = await db
		.insert(ingredients)
		.values(ingredientsData)
		.returning();
	console.log("✓ Created 20 ingredients");

	// 4. Create ~15 dishes across categories
	console.log("Creating dishes...");
	const dishesData: DishInsert[] = [
		{
			name: "Classic Cheeseburger",
			description: "Juicy beef patty with cheese, lettuce, and tomato",
			price: 1250, // $12.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Bacon Burger",
			description: "Cheeseburger topped with crispy bacon",
			price: 1450, // $14.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Veggie Burger",
			description: "Plant-based patty with fresh vegetables",
			price: 1150, // $11.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Spaghetti Carbonara",
			description: "Classic pasta with bacon, egg, and parmesan",
			price: 1350, // $13.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Pasta Marinara",
			description: "Simple tomato sauce pasta with herbs",
			price: 1050, // $10.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Fettuccine Alfredo",
			description: "Creamy parmesan pasta with garlic",
			price: 1250, // $12.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Grilled Chicken",
			description: "Seasoned grilled chicken with vegetables",
			price: 1650, // $16.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Caesar Salad",
			description: "Crisp romaine with caesar dressing and parmesan",
			price: 850, // $8.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Greek Salad",
			description: "Fresh vegetables with feta and olives",
			price: 900, // $9.00
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Garden Salad",
			description: "Mixed greens with seasonal vegetables",
			price: 750, // $7.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Mushroom Risotto",
			description: "Creamy rice with mushrooms and parmesan",
			price: 1450, // $14.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Soda",
			description: "Assorted soft drinks",
			price: 250, // $2.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Fresh Juice",
			description: "Orange, apple, or mixed fruit juice",
			price: 350, // $3.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Bottled Water",
			description: "Still or sparkling water",
			price: 200, // $2.00
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			name: "Garlic Bread",
			description: "Toasted bread with garlic butter",
			price: 550, // $5.50
			photoUrl: null,
			isAvailable: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];
	const insertedDishes = await db.insert(dishes).values(dishesData).returning();
	console.log("✓ Created 15 dishes");

	// 5. Create recipes (link dishes to ingredients)
	console.log("Creating recipes...");
	
	// Helper function to find ingredient/dish IDs by name
	const getIngredientId = (name: string) =>
		insertedIngredients.find((i) => i.name === name)?.id!;
	const getDishId = (name: string) =>
		insertedDishes.find((d) => d.name === name)?.id!;

	const recipesData: RecipeInsert[] = [
		// Classic Cheeseburger
		{
			dishId: getDishId("Classic Cheeseburger"),
			ingredientId: getIngredientId("Beef Patty"),
			quantityRequired: 1,
		},
		{
			dishId: getDishId("Classic Cheeseburger"),
			ingredientId: getIngredientId("Lettuce"),
			quantityRequired: 0.05,
		},
		{
			dishId: getDishId("Classic Cheeseburger"),
			ingredientId: getIngredientId("Tomato"),
			quantityRequired: 0.05,
		},
		{
			dishId: getDishId("Classic Cheeseburger"),
			ingredientId: getIngredientId("Cheese Slices"),
			quantityRequired: 1,
		},
		{
			dishId: getDishId("Classic Cheeseburger"),
			ingredientId: getIngredientId("Burger Buns"),
			quantityRequired: 1,
		},
		// Bacon Burger
		{
			dishId: getDishId("Bacon Burger"),
			ingredientId: getIngredientId("Beef Patty"),
			quantityRequired: 1,
		},
		{
			dishId: getDishId("Bacon Burger"),
			ingredientId: getIngredientId("Bacon"),
			quantityRequired: 2,
		},
		{
			dishId: getDishId("Bacon Burger"),
			ingredientId: getIngredientId("Cheese Slices"),
			quantityRequired: 1,
		},
		{
			dishId: getDishId("Bacon Burger"),
			ingredientId: getIngredientId("Burger Buns"),
			quantityRequired: 1,
		},
		// Spaghetti Carbonara
		{
			dishId: getDishId("Spaghetti Carbonara"),
			ingredientId: getIngredientId("Pasta"),
			quantityRequired: 0.2,
		},
		{
			dishId: getDishId("Spaghetti Carbonara"),
			ingredientId: getIngredientId("Bacon"),
			quantityRequired: 2,
		},
		{
			dishId: getDishId("Spaghetti Carbonara"),
			ingredientId: getIngredientId("Parmesan"),
			quantityRequired: 0.05,
		},
		{
			dishId: getDishId("Spaghetti Carbonara"),
			ingredientId: getIngredientId("Olive Oil"),
			quantityRequired: 0.02,
		},
		// Pasta Marinara
		{
			dishId: getDishId("Pasta Marinara"),
			ingredientId: getIngredientId("Pasta"),
			quantityRequired: 0.2,
		},
		{
			dishId: getDishId("Pasta Marinara"),
			ingredientId: getIngredientId("Tomato Sauce"),
			quantityRequired: 0.15,
		},
		{
			dishId: getDishId("Pasta Marinara"),
			ingredientId: getIngredientId("Garlic"),
			quantityRequired: 0.01,
		},
		{
			dishId: getDishId("Pasta Marinara"),
			ingredientId: getIngredientId("Olive Oil"),
			quantityRequired: 0.02,
		},
		// Fettuccine Alfredo
		{
			dishId: getDishId("Fettuccine Alfredo"),
			ingredientId: getIngredientId("Pasta"),
			quantityRequired: 0.2,
		},
		{
			dishId: getDishId("Fettuccine Alfredo"),
			ingredientId: getIngredientId("Cream"),
			quantityRequired: 0.1,
		},
		{
			dishId: getDishId("Fettuccine Alfredo"),
			ingredientId: getIngredientId("Parmesan"),
			quantityRequired: 0.05,
		},
		{
			dishId: getDishId("Fettuccine Alfredo"),
			ingredientId: getIngredientId("Garlic"),
			quantityRequired: 0.01,
		},
		// Grilled Chicken
		{
			dishId: getDishId("Grilled Chicken"),
			ingredientId: getIngredientId("Chicken Breast"),
			quantityRequired: 1,
		},
		{
			dishId: getDishId("Grilled Chicken"),
			ingredientId: getIngredientId("Olive Oil"),
			quantityRequired: 0.02,
		},
		{
			dishId: getDishId("Grilled Chicken"),
			ingredientId: getIngredientId("Salt"),
			quantityRequired: 0.005,
		},
		{
			dishId: getDishId("Grilled Chicken"),
			ingredientId: getIngredientId("Black Pepper"),
			quantityRequired: 0.002,
		},
		// Caesar Salad
		{
			dishId: getDishId("Caesar Salad"),
			ingredientId: getIngredientId("Lettuce"),
			quantityRequired: 0.1,
		},
		{
			dishId: getDishId("Caesar Salad"),
			ingredientId: getIngredientId("Caesar Dressing"),
			quantityRequired: 0.05,
		},
		{
			dishId: getDishId("Caesar Salad"),
			ingredientId: getIngredientId("Parmesan"),
			quantityRequired: 0.03,
		},
		// Mushroom Risotto
		{
			dishId: getDishId("Mushroom Risotto"),
			ingredientId: getIngredientId("Rice"),
			quantityRequired: 0.15,
		},
		{
			dishId: getDishId("Mushroom Risotto"),
			ingredientId: getIngredientId("Mushrooms"),
			quantityRequired: 0.1,
		},
		{
			dishId: getDishId("Mushroom Risotto"),
			ingredientId: getIngredientId("Parmesan"),
			quantityRequired: 0.04,
		},
		{
			dishId: getDishId("Mushroom Risotto"),
			ingredientId: getIngredientId("Cream"),
			quantityRequired: 0.05,
		},
	];

	await db.insert(recipes).values(recipesData);
	console.log("✓ Created recipes linking dishes to ingredients");

	console.log("✅ Database seed completed successfully!");
	console.log(
		"   - 3 users (admin@restauranthub.com, chef@restauranthub.com, waiter@restauranthub.com)",
	);
	console.log("   - 30 tables with QR codes");
	console.log("   - 20 ingredients with stock");
	console.log("   - 15 dishes");
	console.log("   - Recipes linking dishes to ingredients");
}

// Run seed if this file is executed directly
if (import.meta.main) {
	seed()
		.catch((err) => {
			console.error("❌ Seed failed:", err);
			process.exit(1);
		})
		.finally(() => {
			process.exit(0);
		});
}

export { seed };
