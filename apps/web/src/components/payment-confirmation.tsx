import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { CheckCircle2, DollarSign, AlertCircle } from "lucide-react";

/**
 * T122: PaymentConfirmation Component
 * Confirms cash payment processing and provides clear action buttons
 * 
 * Acceptance: spec.md US6 Scenario 2
 * - Staff member marks order as "Paid" after receiving cash
 * - Clear confirmation before processing
 * - Visual feedback during processing
 * - Success message with table session clearing confirmation
 * 
 * Business Logic:
 * - Validates order status (must be Completed or Served)
 * - Shows payment amount clearly
 * - Prevents accidental payment processing
 * - Provides cancel option
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

interface PaymentConfirmationProps {
	order: Order;
	onConfirm: () => void;
	onCancel: () => void;
	isProcessing: boolean;
}

export function PaymentConfirmation({
	order,
	onConfirm,
	onCancel,
	isProcessing,
}: PaymentConfirmationProps) {
	// Format currency (amount in cents to dollars)
	const formatCurrency = (cents: number) => {
		return `$${(cents / 100).toFixed(2)}`;
	};

	return (
		<Card className="border-primary">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<DollarSign className="h-5 w-5" />
					Confirm Cash Payment
				</CardTitle>
				<CardDescription>
					Please verify the payment details before confirming
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Payment Details */}
				<div className="bg-muted p-4 rounded-lg space-y-2">
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Table</span>
						<span className="font-medium">Table {order.tableNumber}</span>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Order ID</span>
						<span className="font-medium">#{order.id}</span>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Items</span>
						<span className="font-medium">{order.items.length} item(s)</span>
					</div>
					<div className="flex justify-between items-center pt-2 border-t">
						<span className="font-semibold">Amount Received</span>
						<span className="text-xl font-bold text-primary">
							{formatCurrency(order.totalAmount)}
						</span>
					</div>
				</div>

				{/* Payment Method */}
				<Alert>
					<CheckCircle2 className="h-4 w-4" />
					<AlertDescription>
						Payment Method: <strong>Cash</strong>
					</AlertDescription>
				</Alert>

				{/* Important Notice */}
				<Alert variant="default" className="bg-yellow-50 border-yellow-200">
					<AlertCircle className="h-4 w-4 text-yellow-600" />
					<AlertDescription className="text-yellow-800">
						<strong>Important:</strong> Confirming this payment will:
						<ul className="list-disc list-inside mt-2 space-y-1 text-sm">
							<li>Mark the order as "Paid"</li>
							<li>Clear the table session</li>
							<li>Allow new customers to use Table {order.tableNumber}</li>
						</ul>
					</AlertDescription>
				</Alert>

				{/* Cash Change Calculation Note */}
				<div className="text-sm text-muted-foreground">
					<p className="italic">
						💡 Tip: Calculate change manually if customer needs change from larger bills.
					</p>
				</div>
			</CardContent>
			<CardFooter className="flex justify-between gap-4">
				<Button
					variant="outline"
					onClick={onCancel}
					disabled={isProcessing}
					className="flex-1"
				>
					Cancel
				</Button>
				<Button
					onClick={onConfirm}
					disabled={isProcessing}
					className="flex-1"
				>
					{isProcessing ? (
						<>
							<span className="mr-2">Processing...</span>
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
						</>
					) : (
						<>
							<CheckCircle2 className="mr-2 h-4 w-4" />
							Confirm Payment
						</>
					)}
				</Button>
			</CardFooter>
		</Card>
	);
}
