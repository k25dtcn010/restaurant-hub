/**
 * WebSocket Handler for Real-Time Order Notifications
 * Reference: research.md Section 1 - Real-Time Notification Architecture
 * Documentation: https://hono.dev/docs/helpers/websocket
 *
 * Manages WebSocket connections for different user roles:
 * - Kitchen: Receives NEW_ORDER events when orders are submitted
 * - Serving: Receives ORDER_READY events when orders are ready to serve
 * - Manager: Receives all events for monitoring
 *
 * Events:
 * - NEW_ORDER: { type: 'NEW_ORDER', order: Order }
 * - ORDER_STATUS_CHANGED: { type: 'ORDER_STATUS_CHANGED', orderId: number, status: OrderStatus }
 * - ORDER_READY: { type: 'ORDER_READY', orderId: number, tableId: number }
 * - LOW_STOCK_ALERT: { type: 'LOW_STOCK_ALERT', ingredient: Ingredient }
 *
 * Usage with Bun:
 * export default { fetch: app.fetch, websocket }
 */

import { upgradeWebSocket, websocket } from "hono/bun";
import type { WSContext } from "hono/ws";

export type WebSocketRole = "kitchen" | "serving" | "manager" | "anonymous";

// Connection pools by role
const connections = {
	kitchen: new Set<WSContext>(),
	serving: new Set<WSContext>(),
	manager: new Set<WSContext>(),
	anonymous: new Set<WSContext>(),
};

/**
 * Broadcast message to specific role(s)
 */
export function broadcast(
	roles: WebSocketRole[],
	message: Record<string, unknown>,
) {
	const messageStr = JSON.stringify(message);
	for (const role of roles) {
		connections[role].forEach((ws) => {
			try {
				ws.send(messageStr);
			} catch (error) {
				console.error(`[WebSocket] Failed to send to ${role}:`, error);
			}
		});
	}
}

/**
 * Notify kitchen staff of new orders
 */
export function notifyKitchen(order: unknown) {
	broadcast(["kitchen", "manager"], {
		type: "NEW_ORDER",
		order,
		timestamp: new Date().toISOString(),
	});
}

/**
 * Notify serving staff that order is ready
 */
export function notifyServing(orderId: number, tableId: number) {
	broadcast(["serving", "manager"], {
		type: "ORDER_READY",
		orderId,
		tableId,
		timestamp: new Date().toISOString(),
	});
}

/**
 * Notify all relevant parties of order status change
 */
export function notifyOrderStatusChanged(orderId: number, status: string) {
	broadcast(["kitchen", "serving", "manager"], {
		type: "ORDER_STATUS_CHANGED",
		orderId,
		status,
		timestamp: new Date().toISOString(),
	});
}

/**
 * Notify managers of low stock alert
 */
export function notifyLowStock(ingredient: unknown) {
	broadcast(["manager"], {
		type: "LOW_STOCK_ALERT",
		ingredient,
		timestamp: new Date().toISOString(),
	});
}

/**
 * Create WebSocket route handler
 * Query parameter 'role' determines which event types the client receives
 * Example: /ws?role=kitchen
 */
export function createWebSocketHandler() {
	return upgradeWebSocket((c) => {
		const role = (c.req.query("role") as WebSocketRole) || "anonymous";
		let ws: WSContext;

		return {
			onOpen(_event, wsContext) {
				ws = wsContext;
				connections[role].add(ws);
				console.log(`[WebSocket] Client connected as ${role}`);

				// Send welcome message
				ws.send(
					JSON.stringify({
						type: "CONNECTED",
						role,
						timestamp: new Date().toISOString(),
					}),
				);
			},

			onMessage(event) {
				try {
					const data = JSON.parse(event.data.toString());
					console.log(`[WebSocket] Message from ${role}:`, data);

					// Handle client messages (e.g., ping)
					if (data.type === "PING") {
						ws.send(
							JSON.stringify({
								type: "PONG",
								timestamp: new Date().toISOString(),
							}),
						);
					}
				} catch (error) {
					console.error("[WebSocket] Failed to parse message:", error);
				}
			},

			onClose() {
				connections[role].delete(ws);
				console.log(`[WebSocket] Client disconnected from ${role}`);
			},

			onError(error) {
				console.error(`[WebSocket] Error for ${role}:`, error);
			},
		};
	});
}

/**
 * Get current connection count by role
 */
export function getConnectionStats() {
	return {
		kitchen: connections.kitchen.size,
		serving: connections.serving.size,
		manager: connections.manager.size,
		anonymous: connections.anonymous.size,
		total:
			connections.kitchen.size +
			connections.serving.size +
			connections.manager.size +
			connections.anonymous.size,
	};
}

// Export websocket for Bun server integration
export { websocket };
