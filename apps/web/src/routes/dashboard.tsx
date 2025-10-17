import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
	component: RouteComponent,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			redirect({
				to: "/login",
				throw: true,
			});
		}
		return { session };
	},
});

function RouteComponent() {
	const { session } = Route.useRouteContext();

	const healthCheck = useQuery(trpc.healthCheck.queryOptions());

	return (
		<div className="container mx-auto p-8">
			<h1 className="text-3xl font-bold mb-4">Dashboard</h1>
			<p className="text-lg mb-2">Welcome, {session.data?.user.name}!</p>
			{healthCheck.data && (
				<p className="text-sm text-green-600 mt-4">
					API Status: {healthCheck.data.status} (
					{healthCheck.data.timestamp})
				</p>
			)}
			<Button
				className="mt-4"
				onClick={() => authClient.signOut()}
			>
				Sign Out
			</Button>
		</div>
	);
}
