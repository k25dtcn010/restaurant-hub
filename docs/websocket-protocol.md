# WebSocket Protocol Documentation

**Version**: 1.0.0  
**Endpoint**: `ws://localhost:3000/ws`  
**Protocol**: WebSocket with role-based event routing

This document describes all WebSocket events, connection management, and real-time notification flows for RestaurantHub.

---

## Table of Contents

1. [Connection Management](#connection-management)
2. [Event Types](#event-types)
3. [Role-Based Routing](#role-based-routing)
4. [Message Formats](#message-formats)
5. [Error Handling](#error-handling)
6. [Client Examples](#client-examples)

---

## Connection Management

### Establishing Connection

Connect to WebSocket endpoint with role query parameter:

```typescript
const ws = new WebSocket("ws://localhost:3000/ws?role=kitchen")
```

**Supported Roles**:

- `kitchen` - Receives order creation events
- `serving` - Receives ready-to-serve events
- `manager` - Receives all events (monitoring)

### Connection Lifecycle

```
Client                                  Server
  │                                       │
  ├──── WS Handshake ──────────────────► │
  │                                       │ (Add to role pool)
  ◄──── Connection Established ──────────┤
  │                                       │
  ◄──── Event Messages ──────────────────┤
  │                                       │
  ├──── Close ────────────────────────►  │
  │                                       │ (Remove from pool)
```

### Connection Pooling

Server maintains separate connection pools per role:

```typescript
connections = {
  kitchen: Set<WebSocket>,
  serving: Set<WebSocket>,
  manager: Set<WebSocket>,
  anonymous: Set<WebSocket>,
}
```

**Connection Statistics**: `GET /ws/stats`

```typescript
{
  kitchen: 5,
  serving: 3,
  manager: 2,
  anonymous: 0,
  total: 10
}
```

---

## Event Types

### 1. NEW_ORDER

**Sent To**: Kitchen staff, Managers  
**Triggered By**: `orders.submit` API call  
**Description**: New order submitted and needs preparation

**Message Format**:

```typescript
{
  type: "NEW_ORDER"
  order: {
    id: number
    tableNumber: number
    status: "Pending"
    items: Array<{
      dishName: string
      quantity: number
      specialInstructions?: string
    }>
    totalAmount: number
    createdAt: string // ISO 8601
  }
  timestamp: string // ISO 8601
}
```

**Example**:

```json
{
  "type": "NEW_ORDER",
  "order": {
    "id": 42,
    "tableNumber": 5,
    "status": "Pending",
    "items": [
      {
        "dishName": "Burger",
        "quantity": 2,
        "specialInstructions": "No onions"
      },
      {
        "dishName": "Fries",
        "quantity": 1
      }
    ],
    "totalAmount": 2500,
    "createdAt": "2025-10-18T03:20:00.000Z"
  },
  "timestamp": "2025-10-18T03:20:00.123Z"
}
```

**Client Handling**:

```typescript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.type === "NEW_ORDER") {
    // Add order to kitchen board
    queryClient.invalidateQueries(["orders.getKitchenOrders"])
    toast.success(`New order for Table ${message.order.tableNumber}`)
  }
}
```

---

### 2. ORDER_STATUS_CHANGED

**Sent To**: Kitchen staff, Serving staff, Managers  
**Triggered By**: `orders.updateStatus` API call  
**Description**: Order status updated (any transition)

**Message Format**:

```typescript
{
  type: "ORDER_STATUS_CHANGED"
  orderId: number
  status: "InKitchen" | "ReadyToServe" | "Served" | "Completed" | "Cancelled"
  timestamp: string
}
```

**Example**:

```json
{
  "type": "ORDER_STATUS_CHANGED",
  "orderId": 42,
  "status": "InKitchen",
  "timestamp": "2025-10-18T03:25:00.000Z"
}
```

---

### 3. ORDER_READY

**Sent To**: Serving staff, Managers  
**Triggered By**: `orders.updateStatus` with status "ReadyToServe"  
**Description**: Order is ready for serving staff to deliver

**Message Format**:

```typescript
{
  type: "ORDER_READY"
  orderId: number
  tableId: number
  timestamp: string
}
```

**Example**:

```json
{
  "type": "ORDER_READY",
  "orderId": 42,
  "tableId": 5,
  "timestamp": "2025-10-18T03:30:00.000Z"
}
```

**Client Handling**:

```typescript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.type === "ORDER_READY") {
    // Update serving queue
    queryClient.invalidateQueries(["orders.getServingOrders"])
    toast.info(`Order #${message.orderId} ready for Table ${message.tableId}`)
    // Play notification sound
    playNotificationSound()
  }
}
```

---

### 4. LOW_STOCK_ALERT

**Sent To**: Managers  
**Triggered By**: `inventory.adjustStock` when quantity < threshold  
**Description**: Ingredient stock below minimum threshold

**Message Format**:

```typescript
{
  type: "LOW_STOCK_ALERT"
  ingredient: {
    id: number
    name: string
    quantity: number
    threshold: number
    unit: string
  }
  timestamp: string
}
```

**Example**:

```json
{
  "type": "LOW_STOCK_ALERT",
  "ingredient": {
    "id": 3,
    "name": "Flour",
    "quantity": 8.5,
    "threshold": 10,
    "unit": "kg"
  },
  "timestamp": "2025-10-18T04:00:00.000Z"
}
```

---

## Role-Based Routing

### Event Distribution Matrix

| Event Type           | Kitchen | Serving | Manager | Anonymous |
| -------------------- | ------- | ------- | ------- | --------- |
| NEW_ORDER            | ✓       | ✗       | ✓       | ✗         |
| ORDER_STATUS_CHANGED | ✓       | ✓       | ✓       | ✗         |
| ORDER_READY          | ✗       | ✓       | ✓       | ✗         |
| LOW_STOCK_ALERT      | ✗       | ✗       | ✓       | ✗         |

### Broadcasting Logic

```typescript
// Server-side broadcast function
function broadcast(roles: WebSocketRole[], message: object) {
  const messageStr = JSON.stringify(message);
  for (const role of roles) {
    connections[role].forEach(ws => {
      ws.send(messageStr);
    });
  }
}

// Example: Notify kitchen of new order
notifyKitchen(order) {
  broadcast(['kitchen', 'manager'], {
    type: 'NEW_ORDER',
    order,
    timestamp: new Date().toISOString()
  });
}
```

---

## Message Formats

### General Structure

All messages follow this structure:

```typescript
{
  type: string // Event type identifier
  timestamp: string // ISO 8601 timestamp
  // ... event-specific fields
}
```

### Field Types

| Field       | Type   | Format           | Example                      |
| ----------- | ------ | ---------------- | ---------------------------- |
| `type`      | string | UPPER_SNAKE_CASE | "NEW_ORDER"                  |
| `timestamp` | string | ISO 8601         | "2025-10-18T03:20:00.000Z"   |
| `orderId`   | number | Integer          | 42                           |
| `tableId`   | number | Integer          | 5                            |
| `status`    | string | Enum             | "Pending", "InKitchen", etc. |
| `amount`    | number | Cents            | 2500 (= $25.00)              |

---

## Error Handling

### Connection Errors

```typescript
ws.onerror = (error) => {
  console.error("[WebSocket Error]", error)
  toast.error("Connection error. Reconnecting...")
  // Implement exponential backoff reconnection
}
```

### Reconnection Strategy

```typescript
let reconnectAttempts = 0
const maxReconnectAttempts = 5
const baseDelay = 1000 // 1 second

function connect() {
  const ws = new WebSocket("ws://localhost:3000/ws?role=kitchen")

  ws.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = baseDelay * Math.pow(2, reconnectAttempts)
      setTimeout(() => {
        reconnectAttempts++
        connect()
      }, delay)
    }
  }

  ws.onopen = () => {
    reconnectAttempts = 0 // Reset on successful connection
  }
}
```

### Message Parsing Errors

```typescript
ws.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data)
    handleMessage(message)
  } catch (error) {
    console.error("[WebSocket Parse Error]", error)
    // Ignore malformed messages
  }
}
```

---

## Client Examples

### React Hook for WebSocket

```typescript
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { queryClient } from "@/utils/trpc"

export function useWebSocket(role: "kitchen" | "serving" | "manager") {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000/ws?role=${role}`)

    ws.onopen = () => {
      console.log("[WebSocket] Connected as", role)
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      console.log("[WebSocket Message]", message)

      switch (message.type) {
        case "NEW_ORDER":
          queryClient.invalidateQueries(["orders.getKitchenOrders"])
          toast.success(`New order for Table ${message.order.tableNumber}`)
          break

        case "ORDER_READY":
          queryClient.invalidateQueries(["orders.getServingOrders"])
          toast.info(`Order #${message.orderId} ready`)
          break

        case "LOW_STOCK_ALERT":
          toast.warning(`Low stock: ${message.ingredient.name}`)
          break
      }
    }

    ws.onclose = () => {
      console.log("[WebSocket] Disconnected")
      setIsConnected(false)
    }

    ws.onerror = (error) => {
      console.error("[WebSocket Error]", error)
    }

    return () => {
      ws.close()
    }
  }, [role])

  return { isConnected }
}
```

### Usage in Components

```typescript
// Kitchen Dashboard
function KitchenDashboard() {
  const { isConnected } = useWebSocket('kitchen');

  return (
    <div>
      <StatusIndicator connected={isConnected} />
      {/* Kitchen orders board */}
    </div>
  );
}

// Serving Dashboard
function ServingDashboard() {
  const { isConnected } = useWebSocket('serving');

  return (
    <div>
      <StatusIndicator connected={isConnected} />
      {/* Serving queue */}
    </div>
  );
}
```

---

## Performance Considerations

### Connection Limits

- Maximum 50 concurrent connections per role
- Idle connections closed after 30 minutes
- Automatic cleanup of stale connections

### Message Throttling

- Maximum 100 messages per second per connection
- Burst limit: 10 messages in 1 second
- Throttled connections receive rate limit warning

### Bandwidth Optimization

- Message compression enabled (gzip)
- JSON payload kept minimal (no redundant fields)
- Batch similar events when possible

---

## Security

### Authentication

- Role validation on connection establishment
- Optional: Verify session token in query parameter
- Reject connections with invalid roles

### Authorization

- Role-based message filtering
- Prevent cross-role message injection
- Validate message source before broadcasting

### Best Practices

- Use WSS (WebSocket Secure) in production
- Implement connection token expiration
- Log all connection attempts for monitoring
- Rate limit connection attempts per IP

---

**Generated**: 2025-10-18  
**Reference**: `apps/server/src/websocket.ts`  
**Architecture**: [research.md Section 1](../specs/001-restaurant-hub-mvp/research.md#1-real-time-notification-architecture)
