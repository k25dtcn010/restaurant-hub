import { OrderCard } from "./order-card";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, useState } from "react";
import { queryClient } from "@/utils/trpc";
import { useWebSocket } from "@/hooks/use-websocket";
import { toast } from "sonner";

/**
 * T069: OrdersBoard Component
 * Kanban-style board with status columns (Pending, In Kitchen, Ready)
 * 
 * Acceptance: spec.md US2 Scenario 5
 * - Orders displayed in columns by status
 * - Clear visual distinction between statuses
 * 
 * T071: WebSocket connection for real-time order updates
 * WebSocket Integration: research.md Section 6
 * - Query invalidation pattern for real-time updates
 * Plan Reference: plan.md Task 3.3 - WebSocket integration
 * 
 * T074: Auto-refresh and real-time notification handling
 * State Management: research.md Section 6
 * - TanStack Query handles server state
 * - WebSocket messages trigger query invalidation
 */

interface OrderItem {
	dishName: string;
	quantity: number;
	specialInstructions: string | null;
}

interface Order {
	id: number;
	tableNumber: number;
	status: "Pending" | "InKitchen" | "ReadyToServe";
	items: OrderItem[];
	createdAt: Date;
	updatedAt: Date;
	waitTime: number;
}

interface OrdersBoardProps {
	orders: Order[];
	onRefresh: () => void;
}

export function OrdersBoard({ orders, onRefresh }: OrdersBoardProps) {
	const [isConnected, setIsConnected] = useState(false);

	/**
	 * T071 & T074: WebSocket integration for real-time updates
	 * 
	 * Connects to WebSocket server with 'kitchen' role
	 * Listens for NEW_ORDER and ORDER_STATUS_CHANGED events
	 * Automatically invalidates queries and shows notifications
	 */
	const handleWebSocketMessage = useCallback((message: { type: string; [key: string]: unknown }) => {
		console.log("[OrdersBoard] WebSocket message:", message);

		switch (message.type) {
			case "NEW_ORDER":
				// Invalidate queries to refetch kitchen orders
				queryClient.invalidateQueries({
					predicate: (query) => query.queryKey[0] === "orders.getKitchenOrders",
				});
				
				// Show notification
				const order = message.order as { id?: number; tableNumber?: number };
				if (order?.tableNumber) {
					toast.success(`New order from Table ${order.tableNumber}`, {
						description: `Order #${order.id}`,
					});
				}
				break;

			case "ORDER_STATUS_CHANGED":
				// Invalidate queries to refetch kitchen orders
				queryClient.invalidateQueries({
					predicate: (query) => query.queryKey[0] === "orders.getKitchenOrders",
				});
				break;

			default:
				// Ignore other message types
				break;
		}
	}, []);

	// Connect to WebSocket with 'kitchen' role
	const { getStatus } = useWebSocket({
		role: "kitchen",
		onMessage: handleWebSocketMessage,
		onConnect: () => {
			console.log("[OrdersBoard] WebSocket connected");
			setIsConnected(true);
		},
		onDisconnect: () => {
			console.log("[OrdersBoard] WebSocket disconnected");
			setIsConnected(false);
		},
	});

	const handleWebSocketUpdate = useCallback(() => {
		// Invalidate kitchen orders query to trigger refetch
		queryClient.invalidateQueries({
			predicate: (query) => query.queryKey[0] === "orders.getKitchenOrders",
		});
	}, []);

	// Group orders by status
	const pendingOrders = orders.filter(o => o.status === "Pending");
	const inKitchenOrders = orders.filter(o => o.status === "InKitchen");
	const readyOrders = orders.filter(o => o.status === "ReadyToServe");

	// Column configuration
	const columns = [
		{
			title: "Pending",
			status: "Pending" as const,
			orders: pendingOrders,
			color: "yellow",
			description: "Orders waiting to be started",
		},
		{
			title: "In Kitchen",
			status: "InKitchen" as const,
			orders: inKitchenOrders,
			color: "blue",
			description: "Currently being prepared",
		},
		{
			title: "Ready to Serve",
			status: "ReadyToServe" as const,
			orders: readyOrders,
			color: "green",
			description: "Ready for pickup",
		},
	];

	return (
		<div className="space-y-4">
			{/* Header with WebSocket status and refresh button */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<p className="text-sm text-muted-foreground">
						{orders.length} active {orders.length === 1 ? "order" : "orders"}
					</p>
					<Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
						{isConnected ? (
							<>
								<Wifi className="h-3 w-3" />
								Live
							</>
						) : (
							<>
								<WifiOff className="h-3 w-3" />
								Offline
							</>
						)}
					</Badge>
				</div>
				<Button
					onClick={onRefresh}
					variant="outline"
					size="sm"
				>
					<RefreshCw className="mr-2 h-4 w-4" />
					Refresh
				</Button>
			</div>

			{/* Kanban Board */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{columns.map((column) => (
					<div key={column.status} className="space-y-4">
						{/* Column Header */}
						<Card className="bg-muted/30">
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<CardTitle className="text-lg">
										{column.title}
									</CardTitle>
									<span className="text-2xl font-bold text-muted-foreground">
										{column.orders.length}
									</span>
								</div>
								<p className="text-sm text-muted-foreground">
									{column.description}
								</p>
							</CardHeader>
						</Card>

						{/* Orders in Column */}
						<div className="space-y-3">
							{column.orders.length === 0 ? (
								<Card>
									<CardContent className="py-8 text-center text-muted-foreground">
										No orders in {column.title.toLowerCase()}
									</CardContent>
								</Card>
							) : (
								column.orders.map((order) => (
									<OrderCard
										key={order.id}
										order={order}
										onStatusUpdate={handleWebSocketUpdate}
									/>
								))
							)}
						</div>
					</div>
				))}
			</div>

			{/* Empty state */}
			{orders.length === 0 && (
				<Card>
					<CardContent className="py-12 text-center">
						<p className="text-lg text-muted-foreground mb-2">
							No active orders
						</p>
						<p className="text-sm text-muted-foreground">
							New orders will appear here automatically
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
