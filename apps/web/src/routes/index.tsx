import { createFileRoute } from "@tanstack/react-router";
import { trpc, trpcClient, queryClient } from "@/utils/trpc";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MenuList } from "@/components/menu-list";
import { OrderCart } from "@/components/order-cart";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";

/**
 * T054: Landing page route with QR parameter handling
 * T057: Order submission flow with success/error handling
 * T059: Loading states and optimistic updates
 * 
 * QR Session Logic: research.md Section 4
 * Acceptance: spec.md US1 Scenarios 1-6
 */

export const Route = createFileRoute("/")({
	component: HomeComponent,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			table: search.table ? Number(search.table) : undefined,
		};
	},
});

interface CartItem {
	dishId: number;
	dishName: string;
	quantity: number;
	priceAtOrder: number;
}

function HomeComponent() {
	const { table } = Route.useSearch();
	const [cart, setCart] = useState<Map<number, CartItem>>(new Map());
	
	// Fetch dishes
	const { data: dishesData, isLoading: dishesLoading } = useQuery(
		trpc.dishes.getAll.queryOptions({
			includeDisabled: false,
		})
	);

	// Fetch table info if table ID is provided - only when table is set
	const tableQueryEnabled = !!table;
	const { data: tableData, isLoading: tableLoading } = useQuery({
		...trpc.tables.getById.queryOptions({ tableId: table || 0 }),
		enabled: tableQueryEnabled,
	});

	// Order creation mutation
	const createOrderMutation = useMutation({
		mutationFn: (variables: { tableId: number; items: Array<{ dishId: number; quantity: number }> }) => 
			trpcClient.orders.create.mutate(variables),
	});
	
	const submitOrderMutation = useMutation({
		mutationFn: (variables: { orderId: number }) => 
			trpcClient.orders.submit.mutate(variables),
	});

	const dishes = dishesData?.dishes || [];

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
		if (!table) {
			toast.error("No table selected. Please scan a QR code.");
			return;
		}

		if (cart.size === 0) {
			toast.error("Your cart is empty. Add items before submitting.");
			return;
		}

		try {
			// Create order
			const items = Array.from(cart.values()).map((item) => ({
				dishId: item.dishId,
				quantity: item.quantity,
			}));

			const createResult = await createOrderMutation.mutateAsync({
				tableId: table,
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
					: "Items added to your existing order!"
			);

			// Clear cart
			setCart(new Map());
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

	const isLoading = dishesLoading || (tableQueryEnabled && tableLoading);

	return (
		<div className="container mx-auto px-4 py-6">
			<div className="mb-6">
				<h1 className="text-3xl font-bold tracking-tight">
					{table ? `Table ${table} - Menu` : "Restaurant Menu"}
				</h1>
				{tableData && (
					<p className="text-muted-foreground">
						Capacity: {tableData.capacity} people
					</p>
				)}
				{!table && (
					<p className="text-muted-foreground">
						Scan a QR code at your table to order
					</p>
				)}
			</div>

			<div className="grid gap-6 lg:grid-cols-[1fr_400px]">
				<div>
					<MenuList
						dishes={dishes as any}
						isLoading={isLoading}
						onAddToCart={handleAddToCart}
						cartItems={cartQuantities}
					/>
				</div>

				<div>
					<OrderCart
						items={cartItems}
						tableNumber={table}
						isLoading={isLoading}
						onRemoveItem={handleRemoveItem}
						onSubmit={handleSubmitOrder}
						isSubmitting={createOrderMutation.isPending || submitOrderMutation.isPending}
					/>
				</div>
			</div>
		</div>
	);
}
