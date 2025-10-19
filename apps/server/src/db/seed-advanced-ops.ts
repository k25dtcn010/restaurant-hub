// IMPORTANT: Load environment variables BEFORE importing db
import "dotenv/config"

import type {
  CategoryInsert,
  DishCategoryInsert,
  DishModifierInsert,
  ModifierGroupInsert,
  ModifierInsert,
  OperatingHoursInsert,
  ReservationInsert,
} from "./index"

/**
 * Database seed script for advanced operations management
 * Per spec 002-advanced-ops-management tasks.md T013
 * Creates test data for modifiers, categories, operating hours, and reservations
 */
async function seedAdvancedOps() {
  console.log("🌱 Starting advanced ops seed...")
  console.log(`📁 Database URL: ${process.env.DATABASE_URL}`)

  // Dynamic import after env is loaded
  const {
    db,
    modifiers,
    modifierGroups,
    dishModifiers,
    categories,
    dishCategories,
    operatingHours,
    reservations,
  } = await import("./index")

  // Get existing dishes to assign modifiers and categories
  const { dishes } = await import("./index")
  const existingDishes = await db.select().from(dishes)
  console.log(`Found ${existingDishes.length} existing dishes`)

  // 1. Create 20 modifiers with mix of price adjustments
  console.log("Creating modifiers...")
  const modifiersData: ModifierInsert[] = [
    // Positive price adjustments
    { name: "Extra Cheese", priceAdjustment: 200, isAvailable: true },
    { name: "Bacon", priceAdjustment: 150, isAvailable: true },
    { name: "Avocado", priceAdjustment: 250, isAvailable: true },
    { name: "Extra Patty", priceAdjustment: 400, isAvailable: true },
    { name: "Fried Egg", priceAdjustment: 100, isAvailable: true },
    { name: "Grilled Mushrooms", priceAdjustment: 150, isAvailable: true },
    { name: "Jalapeños", priceAdjustment: 50, isAvailable: true },
    { name: "Pickles", priceAdjustment: 0, isAvailable: true },
    { name: "Onion Rings", priceAdjustment: 200, isAvailable: true },
    { name: "BBQ Sauce", priceAdjustment: 50, isAvailable: true },
    // Negative price adjustments (removals/substitutions)
    { name: "No Onions", priceAdjustment: 0, isAvailable: true },
    { name: "No Tomatoes", priceAdjustment: 0, isAvailable: true },
    { name: "No Lettuce", priceAdjustment: 0, isAvailable: true },
    { name: "No Pickles", priceAdjustment: 0, isAvailable: true },
    { name: "Gluten-Free Bun", priceAdjustment: 150, isAvailable: true },
    { name: "Vegan Cheese", priceAdjustment: 100, isAvailable: true },
    // Mix of available/unavailable
    { name: "Truffle Oil", priceAdjustment: 300, isAvailable: false },
    { name: "Caramelized Onions", priceAdjustment: 100, isAvailable: true },
    { name: "Blue Cheese", priceAdjustment: 200, isAvailable: false },
    { name: "Sriracha Mayo", priceAdjustment: 50, isAvailable: true },
  ]
  const insertedModifiers = await db.insert(modifiers).values(modifiersData).returning()
  console.log("✓ Created 20 modifiers")

  // 2. Create 5 modifier groups
  console.log("Creating modifier groups...")
  const modifierGroupsData: ModifierGroupInsert[] = [
    { name: "Toppings", minSelections: 0, maxSelections: 3, displayOrder: 0 },
    { name: "Size", minSelections: 1, maxSelections: 1, displayOrder: 1 },
    { name: "Protein Add-ons", minSelections: 0, maxSelections: 2, displayOrder: 2 },
    { name: "Sauces", minSelections: 0, maxSelections: 2, displayOrder: 3 },
    { name: "Preparation Style", minSelections: 0, maxSelections: 1, displayOrder: 4 },
  ]
  const insertedGroups = await db.insert(modifierGroups).values(modifierGroupsData).returning()
  console.log("✓ Created 5 modifier groups")

  // 3. Assign modifiers to dishes
  console.log("Assigning modifiers to dishes...")
  const dishModifiersData: DishModifierInsert[] = []
  const assignedSet = new Set<string>() // Track dishId-modifierId pairs to avoid duplicates

  // Helper to find IDs
  const getModifierId = (name: string) => insertedModifiers.find((m) => m.name === name)?.id!
  const getGroupId = (name: string) => insertedGroups.find((g) => g.name === name)?.id!
  const getDishId = (name: string) => existingDishes.find((d) => d.name === name)?.id

  // Helper to add assignment if not duplicate
  const addDishModifier = (dishId: number, modifierId: number, groupId: number) => {
    const key = `${dishId}-${modifierId}`
    if (!assignedSet.has(key)) {
      dishModifiersData.push({ dishId, modifierId, modifierGroupId: groupId })
      assignedSet.add(key)
    }
  }

  // Assign toppings group to burgers
  const burgerDishes = ["Classic Cheeseburger", "Bacon Burger", "Veggie Burger"]
  const toppingModifiers = [
    "Extra Cheese",
    "Bacon",
    "Avocado",
    "Jalapeños",
    "Pickles",
    "Grilled Mushrooms",
  ]
  const toppingsGroupId = getGroupId("Toppings")

  for (const dishName of burgerDishes) {
    const dishId = getDishId(dishName)
    if (dishId) {
      for (const modifierName of toppingModifiers) {
        addDishModifier(dishId, getModifierId(modifierName), toppingsGroupId)
      }
    }
  }

  // Assign protein add-ons group to burgers and salads (excluding Bacon which is already in toppings)
  const proteinModifiers = ["Extra Patty", "Fried Egg"]
  const proteinGroupId = getGroupId("Protein Add-ons")

  for (const dishName of [...burgerDishes, "Caesar Salad", "Greek Salad", "Garden Salad"]) {
    const dishId = getDishId(dishName)
    if (dishId) {
      for (const modifierName of proteinModifiers) {
        addDishModifier(dishId, getModifierId(modifierName), proteinGroupId)
      }
    }
  }

  // Assign sauces group to burgers
  const sauceModifiers = ["BBQ Sauce", "Sriracha Mayo"]
  const saucesGroupId = getGroupId("Sauces")

  for (const dishName of burgerDishes) {
    const dishId = getDishId(dishName)
    if (dishId) {
      for (const modifierName of sauceModifiers) {
        addDishModifier(dishId, getModifierId(modifierName), saucesGroupId)
      }
    }
  }

  if (dishModifiersData.length > 0) {
    await db.insert(dishModifiers).values(dishModifiersData)
    console.log(`✓ Assigned modifiers to ${burgerDishes.length + 3} dishes`)
  }

  // 4. Create 6 categories
  console.log("Creating categories...")
  const categoriesData: CategoryInsert[] = [
    {
      name: "Appetizers",
      displayOrder: 0,
      iconUrl: null,
      isHidden: false,
    },
    {
      name: "Main Course",
      displayOrder: 1,
      iconUrl: null,
      isHidden: false,
    },
    {
      name: "Desserts",
      displayOrder: 2,
      iconUrl: null,
      isHidden: false,
    },
    {
      name: "Beverages",
      displayOrder: 3,
      iconUrl: null,
      isHidden: false,
    },
    {
      name: "Specials",
      displayOrder: 4,
      iconUrl: null,
      isHidden: false,
    },
    {
      name: "Sides",
      displayOrder: 5,
      iconUrl: null,
      isHidden: false,
    },
  ]
  const insertedCategories = await db.insert(categories).values(categoriesData).returning()
  console.log("✓ Created 6 categories")

  // 5. Assign dishes to categories
  console.log("Assigning dishes to categories...")
  const dishCategoriesData: DishCategoryInsert[] = []

  const getCategoryId = (name: string) => insertedCategories.find((c) => c.name === name)?.id!

  const categoryAssignments: Record<string, string[]> = {
    Appetizers: ["Caesar Salad", "Greek Salad", "Garden Salad", "Garlic Bread"],
    "Main Course": [
      "Classic Cheeseburger",
      "Bacon Burger",
      "Veggie Burger",
      "Spaghetti Carbonara",
      "Pasta Marinara",
      "Fettuccine Alfredo",
      "Grilled Chicken",
      "Mushroom Risotto",
    ],
    Beverages: ["Soda", "Fresh Juice", "Bottled Water"],
    Sides: ["Garlic Bread"],
  }

  for (const [categoryName, dishNames] of Object.entries(categoryAssignments)) {
    const categoryId = getCategoryId(categoryName)
    for (const dishName of dishNames) {
      const dishId = getDishId(dishName)
      if (dishId) {
        dishCategoriesData.push({ dishId, categoryId })
      }
    }
  }

  if (dishCategoriesData.length > 0) {
    await db.insert(dishCategories).values(dishCategoriesData)
    console.log(`✓ Assigned ${dishCategoriesData.length} dish-category relationships`)
  }

  // 6. Create operating hours for 7 days
  console.log("Creating operating hours...")
  const operatingHoursData: OperatingHoursInsert[] = [
    // Monday - Thursday: 11:00 - 22:00
    { dayOfWeek: 1, openTime: "11:00", closeTime: "22:00", isClosed: false },
    { dayOfWeek: 2, openTime: "11:00", closeTime: "22:00", isClosed: false },
    { dayOfWeek: 3, openTime: "11:00", closeTime: "22:00", isClosed: false },
    { dayOfWeek: 4, openTime: "11:00", closeTime: "22:00", isClosed: false },
    // Friday - Sunday: 11:00 - 23:00
    { dayOfWeek: 5, openTime: "11:00", closeTime: "23:00", isClosed: false },
    { dayOfWeek: 6, openTime: "11:00", closeTime: "23:00", isClosed: false },
    { dayOfWeek: 0, openTime: "11:00", closeTime: "23:00", isClosed: false },
  ]
  await db.insert(operatingHours).values(operatingHoursData)
  console.log("✓ Created operating hours for 7 days")

  // 7. Create 3 sample reservations
  console.log("Creating sample reservations...")
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Helper to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => date.toISOString().split("T")[0] ?? ""

  const reservationsData: ReservationInsert[] = [
    {
      date: formatDate(tomorrow),
      time: "18:30",
      partySize: 4,
      customerName: "John Smith",
      customerPhone: "+1-555-0101",
      customerEmail: "john@example.com",
      notes: "Anniversary dinner",
      status: "Pending",
      assignedTableIds: null,
      declineReason: null,
    },
    {
      date: formatDate(tomorrow),
      time: "19:00",
      partySize: 2,
      customerName: "Alice Johnson",
      customerPhone: "+1-555-0102",
      customerEmail: "alice@example.com",
      notes: null,
      status: "Confirmed",
      assignedTableIds: JSON.stringify([5]),
      declineReason: null,
    },
    {
      date: formatDate(today),
      time: "12:00",
      partySize: 6,
      customerName: "Bob Williams",
      customerPhone: "+1-555-0103",
      customerEmail: "bob@example.com",
      notes: "Business lunch",
      status: "Seated",
      assignedTableIds: JSON.stringify([10, 11]),
      declineReason: null,
    },
  ]
  await db.insert(reservations).values(reservationsData)
  console.log("✓ Created 3 sample reservations")

  console.log("✅ Advanced ops seed completed successfully!")
  console.log("   - 20 modifiers (mix of positive/negative/zero price adjustments)")
  console.log("   - 5 modifier groups (Toppings, Size, Protein Add-ons, Sauces, Preparation Style)")
  console.log("   - 6 categories (Appetizers, Main Course, Desserts, Beverages, Specials, Sides)")
  console.log("   - Operating hours for 7 days (Mon-Thu: 11:00-22:00, Fri-Sun: 11:00-23:00)")
  console.log("   - 3 sample reservations (1 Pending, 1 Confirmed, 1 Seated)")
  console.log("   - Modifiers assigned to existing dishes")
  console.log("   - Dishes assigned to categories")
}

// Run seed if this file is executed directly
if (import.meta.main) {
  seedAdvancedOps()
    .catch((err) => {
      console.error("❌ Advanced ops seed failed:", err)
      process.exit(1)
    })
    .finally(() => {
      process.exit(0)
    })
}

export { seedAdvancedOps }
