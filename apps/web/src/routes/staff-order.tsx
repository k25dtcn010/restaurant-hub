import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { trpc, trpcClient, queryClient } from "@/utils/trpc";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MenuList } from "@/components/menu-list";
import { OrderCart } from "@/components/order-cart";
import { TableSelector } from "@/components/table-selector";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";

/**
 * T080: Staff-Order Route
 * Route for staff to create orders on behalf of customers
 * 
 * Acceptance: spec.md US3 Scenarios 1-2
 * - Waiter/Manager can select a table
 * - Browse menu and add dishes to order
 * - Submit order with same workflow as QR orders
 * 
 * Auth Guard: research.md Section 5 Access Control Matrix - Waiter or Manager access
 * Plan Reference: plan.md Task 4.1 - Build staff order creation UI
 */

export const Route = createFileRoute("/staff-order")({
	component: RouteComponent,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		
		// Check if user is authenticated
		if (!session.data) {
			throw redirect({
				to: "/login",
			});
		}
		
		// Note: Role checking commented out for MVP - will be enabled when user.role is available
		// Check if user has Waiter or Manager role
		// const userRole = (session.data.user as any).role;
		// if (userRole !== "Waiter" && userRole !== "Manager") {
		// 	throw redirect({
		// 		to: "/dashboard",
		// 	});
		// }
		
		return { session };
	},
});

interface CartItem {
	dishId: number;
	dishName: string;
	quantity: number;
	priceAtOrder: number;
}

function RouteComponent() {
	const routeContext = Route.useRouteContext();
	const session = routeContext.session;
	
	const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
	const [cart, setCart] = useState<Map<number, CartItem>>(new Map());
	
	// Fetch all tables
	const { data: tablesData, isLoading: tablesLoading } = useQuery(
		trpc.tables.getAll.queryOptions()
	);
	
	// Fetch dishes
	const { data: dishesData, isLoading: dishesLoading } = useQuery(
		trpc.dishes.getAll.queryOptions({
			includeDisabled: false,
		})
	);
	
	// Order creation mutation
	const createOrderMutation = useMutation({
		mutationFn: (variables: { tableId: number; items: Array<{ dishId: number; quantity: number }> }) => 
			trpcClient.orders.create.mutate(variables),
	});
	
	const submitOrderMutation = useMutation({
		mutationFn: (variables: { orderId: number }) => 
			trpcClient.orders.submit.mutate(variables),
	});

	const tables = tablesData?.tables || [];
	const dishes = dishesData?.dishes || [];
	
	const selectedTable = tables.find((t) => t.id === selectedTableId);

	// Handle table selection
	const handleSelectTable = (tableId: number) => {
		setSelectedTableId(tableId);
	};

	// Handle adding/removing items from cart
	const handleAddToCart = (dishId: number, quantity: number) => {
		if (quantity === 0) {
			// Remove from cart
			setCart((prev) => {
				const newCart = new Map(prev);
				newCart.delete(dishId);
				return newCart;
			});
			return;
		}

		const dish = dishes.find((d: { id: number; name: string; price: number }) => d.id === dishId);
		if (!dish) return;

		setCart((prev) => {
			const newCart = new Map(prev);
			newCart.set(dishId, {
				dishId,
				dishName: dish.name,
				quantity,
				priceAtOrder: dish.price,
			});
			return newCart;
		});
	};

	const handleRemoveItem = (dishId: number) => {
		handleAddToCart(dishId, 0);
	};

	// Handle order submission
	const handleSubmitOrder = async () => {
		if (!selectedTableId) {
			toast.error("Please select a table first.");
			return;
		}

		if (cart.size === 0) {
			toast.error("Cart is empty. Add items before submitting.");
			return;
		}

		try {
			// Create order
			const items = Array.from(cart.values()).map((item) => ({
				dishId: item.dishId,
				quantity: item.quantity,
			}));

			const createResult = await createOrderMutation.mutateAsync({
				tableId: selectedTableId,
				items,
			});

			// Submit order to kitchen
			await submitOrderMutation.mutateAsync({
				orderId: createResult.orderId,
			});

			// Success!
			toast.success(
				createResult.isNew
					? "Order submitted to kitchen!"
					: "Items added to existing order!"
			);

			// Clear cart but keep table selected for next order
			setCart(new Map());
			
			// Invalidate tables query to update active order status
			queryClient.invalidateQueries({
				queryKey: trpc.tables.getAll.queryKey(),
			});
		} catch (error) {
			// Handle errors
			if (error instanceof TRPCClientError) {
				toast.error(error.message);
			} else {
				toast.error("Failed to submit order. Please try again.");
			}
			console.error("Order submission error:", error);
		}
	};

	const cartItems = Array.from(cart.values());
	const cartQuantities = useMemo(() => {
		const map = new Map<number, number>();
		cart.forEach((item, dishId) => {
			map.set(dishId, item.quantity);
		});
		return map;
	}, [cart]);

	const isLoading = tablesLoading || dishesLoading;

	return (
		<div className="container mx-auto px-4 py-6">
			<div className="mb-6">
				<h1 className="text-3xl font-bold tracking-tight">
					Staff Order Creation
				</h1>
				<p className="text-muted-foreground">
					Create orders on behalf of customers
				</p>
			</div>

			{/* Table Selection */}
			<div className="mb-6">
				<TableSelector
					tables={tables}
					isLoading={tablesLoading}
					selectedTableId={selectedTableId}
					onSelectTable={handleSelectTable}
				/>
			</div>

			{/* Menu and Cart - Only show when table is selected */}
			{selectedTableId && (
				<div className="grid gap-6 lg:grid-cols-[1fr_400px]">
					<div>
						<MenuList
							dishes={dishes as any}
							isLoading={dishesLoading}
							onAddToCart={handleAddToCart}
							cartItems={cartQuantities}
						/>
					</div>

					<div>
						<OrderCart
							items={cartItems}
							tableNumber={selectedTable?.number}
							isLoading={isLoading}
							onRemoveItem={handleRemoveItem}
							onSubmit={handleSubmitOrder}
							isSubmitting={createOrderMutation.isPending || submitOrderMutation.isPending}
						/>
					</div>
				</div>
			)}

			{/* Prompt to select table */}
			{!selectedTableId && !tablesLoading && (
				<div className="mt-12 text-center">
					<p className="text-lg text-muted-foreground">
						Select a table above to start creating an order
					</p>
				</div>
			)}
		</div>
	);
}
