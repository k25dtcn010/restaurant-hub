import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@learn-bettert/api/context";
import { appRouter } from "@learn-bettert/api/routers/index";
import { auth } from "@learn-bettert/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import {
	createWebSocketHandler,
	getConnectionStats,
	websocket,
} from "./websocket";

/**
 * RestaurantHub Backend Server
 * Hono 4.8+ with tRPC 11.5+ integration
 * Reference: plan.md Task 1.6 - Setup tRPC Infrastructure
 *
 * Endpoints:
 * - GET  /                  - Health check
 * - *    /api/auth/*        - Better-Auth authentication endpoints
 * - *    /trpc/*            - tRPC API endpoints
 * - WS   /ws                - WebSocket for real-time notifications
 * - GET  /ws/stats          - WebSocket connection statistics
 */
const app = new Hono();

// Request logging middleware
app.use(logger());

// CORS configuration - allows authenticated requests from web client
app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

// Better-Auth authentication handler
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// tRPC server with context injection
app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

// Health check endpoint
app.get("/", (c) => {
	return c.json({
		status: "OK",
		timestamp: new Date().toISOString(),
		version: "1.0.0",
	});
});

// WebSocket connection statistics (for monitoring)
app.get("/ws/stats", (c) => {
	return c.json(getConnectionStats());
});

// WebSocket endpoint for real-time notifications
// Query parameter 'role' determines event types: kitchen, serving, manager
// Example: ws://localhost:3000/ws?role=kitchen
app.get("/ws", createWebSocketHandler());

// Export for Bun server with WebSocket support
// Reference: https://hono.dev/docs/helpers/websocket#bun-with-jsx
export default {
	fetch: app.fetch,
	websocket,
};
