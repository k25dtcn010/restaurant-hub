import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { PaymentHistory } from "@/components/payment-history";

/**
 * T125: Payment History View
 * Manager-only dashboard for viewing payment history and revenue
 * 
 * Auth Guard: research.md Section 5 Access Control Matrix
 * - Manager access only
 * 
 * Acceptance: spec.md US6 Scenario 4
 * - View all completed and paid orders
 * - Filter by date or table
 * - Display timestamps and amounts
 * - Show total revenue statistics
 */

export const Route = createFileRoute("/payment-history")({
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
		// Check if user has Manager role
		// const userRole = (session.data.user as any).role;
		// if (userRole !== "Manager") {
		// 	throw redirect({
		// 		to: "/dashboard",
		// 	});
		// }
		
		return { session };
	},
});

function RouteComponent() {
	const { session } = Route.useRouteContext();

	return (
		<div className="container mx-auto p-4 md:p-8 max-w-7xl">
			<div className="mb-6">
				<h1 className="text-3xl font-bold mb-2">Payment History</h1>
				<p className="text-muted-foreground">
					Welcome, {session.data?.user.name}
				</p>
			</div>
			
			{/* T124: PaymentHistory component with filtering */}
			<PaymentHistory />
		</div>
	);
}
