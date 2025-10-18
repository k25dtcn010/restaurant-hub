import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";

/**
 * T121: OrderBillView Component
 * Displays itemized order bill with dishes, quantities, prices, and total
 * 
 * Acceptance: spec.md US6 Scenario 1
 * - Shows complete list of dishes with individual prices
 * - Displays quantities for each item
 * - Shows total amount due
 * - Professional bill format suitable for customer review
 */

interface OrderItem {
	dishName: string;
	quantity: number;
	priceAtOrder: number;
}

interface Order {
	id: number;
	tableNumber: number;
	status: string;
	items: OrderItem[];
	totalAmount: number;
	createdAt: string;
}

interface OrderBillViewProps {
	order: Order;
}

export function OrderBillView({ order }: OrderBillViewProps) {
	// Format currency (amount in cents to dollars)
	const formatCurrency = (cents: number) => {
		return `$${(cents / 100).toFixed(2)}`;
	};

	// Calculate subtotal (sum of all items)
	const subtotal = order.items.reduce(
		(sum, item) => sum + item.priceAtOrder * item.quantity,
		0
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Order Bill</CardTitle>
						<CardDescription>
							Table {order.tableNumber} - Order #{order.id}
						</CardDescription>
					</div>
					<Badge 
						variant={
							order.status === "Completed" || order.status === "Served" 
								? "default" 
								: "secondary"
						}
					>
						{order.status}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				{/* Itemized list of dishes */}
				<div className="space-y-3 mb-6">
					{order.items.map((item, index) => (
						<div key={index} className="flex justify-between items-start">
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium">{item.dishName}</span>
									<span className="text-sm text-muted-foreground">
										× {item.quantity}
									</span>
								</div>
								<div className="text-sm text-muted-foreground">
									{formatCurrency(item.priceAtOrder)} each
								</div>
							</div>
							<div className="font-medium">
								{formatCurrency(item.priceAtOrder * item.quantity)}
							</div>
						</div>
					))}
				</div>

				<Separator className="my-4" />

				{/* Subtotal */}
				<div className="flex justify-between items-center mb-2">
					<span className="text-muted-foreground">Subtotal</span>
					<span className="font-medium">{formatCurrency(subtotal)}</span>
				</div>

				{/* Tax/Service (if applicable - currently 0 for MVP) */}
				<div className="flex justify-between items-center mb-2 text-sm text-muted-foreground">
					<span>Tax & Service</span>
					<span>$0.00</span>
				</div>

				<Separator className="my-4" />

				{/* Total Amount Due */}
				<div className="flex justify-between items-center">
					<span className="text-xl font-bold">Total Amount Due</span>
					<span className="text-2xl font-bold text-primary">
						{formatCurrency(order.totalAmount)}
					</span>
				</div>

				{/* Payment method note */}
				<div className="mt-6 p-4 bg-muted rounded-lg">
					<p className="text-sm text-muted-foreground text-center">
						Cash Payment Only - No Card Payments Accepted
					</p>
				</div>

				{/* Order timestamp */}
				<div className="mt-4 text-center text-xs text-muted-foreground">
					Order placed: {new Date(order.createdAt).toLocaleString()}
				</div>
			</CardContent>
		</Card>
	);
}
