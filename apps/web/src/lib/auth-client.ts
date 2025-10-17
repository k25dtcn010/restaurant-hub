import { createAuthClient } from "better-auth/react";

/**
 * Better-Auth client for frontend authentication
 * Provides hooks for session management and authentication actions
 * Reference: plan.md Task 1.5 - Setup Better-Auth
 */
export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_SERVER_URL,
});

// Re-export commonly used hooks for convenience
export const {
	useSession,
	signIn,
	signOut,
	signUp,
} = authClient;
