import type { Context as HonoContext } from "hono";
import { auth } from "@learn-bettert/auth";
import { db } from "@learn-bettert/db";

export type CreateContextOptions = {
	context: HonoContext;
};

/**
 * Creates tRPC context with authenticated user session and database client
 * Reference: research.md Section 5 - Role-Based Access Control
 */
export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});

	return {
		session,
		user: session?.user ?? null,
		role: session?.user?.role ?? null,
		db,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
