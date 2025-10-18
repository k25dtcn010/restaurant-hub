import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

/**
 * WebSocket Hook for Real-Time Order Updates
 *
 * Connects to the WebSocket server at /ws with a specified role
 * Handles reconnection logic and message parsing
 *
 * Events:
 * - CONNECTED: Initial connection established
 * - NEW_ORDER: New order submitted
 * - ORDER_STATUS_CHANGED: Order status updated
 * - ORDER_READY: Order ready to serve
 * - LOW_STOCK_ALERT: Ingredient stock is low
 */

type WebSocketRole = "kitchen" | "serving" | "manager" | "anonymous"

interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

interface UseWebSocketOptions {
  role: WebSocketRole
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  reconnectInterval?: number
}

export function useWebSocket({
  role,
  onMessage,
  onConnect,
  onDisconnect,
  reconnectInterval = 3000,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shouldConnectRef = useRef(true)

  const connect = useCallback(() => {
    // Don't connect if we're not supposed to
    if (!shouldConnectRef.current) return

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close()
    }

    try {
      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const host = import.meta.env.VITE_SERVER_URL?.replace(/^https?:\/\//, "") || "localhost:3000"
      const wsUrl = `${protocol}//${host}/ws?role=${role}`

      console.log(`[WebSocket] Connecting to ${wsUrl}`)
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log(`[WebSocket] Connected as ${role}`)
        onConnect?.()
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage
          console.log(`[WebSocket] Received:`, message)

          // Handle connection confirmation
          if (message.type === "CONNECTED") {
            console.log(`[WebSocket] Connection confirmed for role: ${message.role}`)
            return
          }

          // Handle pong response
          if (message.type === "PONG") {
            return
          }

          // Call custom message handler
          onMessage?.(message)
        } catch (error) {
          console.error("[WebSocket] Failed to parse message:", error)
        }
      }

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error)
      }

      ws.onclose = (event) => {
        console.log(`[WebSocket] Disconnected (code: ${event.code})`)
        onDisconnect?.()

        // Attempt reconnection if we should still be connected
        if (shouldConnectRef.current) {
          console.log(`[WebSocket] Reconnecting in ${reconnectInterval}ms...`)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error("[WebSocket] Failed to connect:", error)
      toast.error("Failed to establish WebSocket connection")

      // Retry connection
      if (shouldConnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, reconnectInterval)
      }
    }
  }, [role, onMessage, onConnect, onDisconnect, reconnectInterval])

  // Send a message to the server
  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn("[WebSocket] Cannot send message, not connected")
    }
  }, [])

  // Send ping to keep connection alive
  const ping = useCallback(() => {
    send({ type: "PING" })
  }, [send])

  // Get connection status
  const getStatus = useCallback(() => {
    if (!wsRef.current) return "disconnected"

    switch (wsRef.current.readyState) {
      case WebSocket.CONNECTING:
        return "connecting"
      case WebSocket.OPEN:
        return "connected"
      case WebSocket.CLOSING:
        return "closing"
      case WebSocket.CLOSED:
        return "disconnected"
      default:
        return "unknown"
    }
  }, [])

  // Connect on mount
  useEffect(() => {
    shouldConnectRef.current = true
    connect()

    // Cleanup on unmount
    return () => {
      shouldConnectRef.current = false

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  // Keep-alive ping every 30 seconds
  useEffect(() => {
    const pingInterval = setInterval(() => {
      ping()
    }, 30000)

    return () => clearInterval(pingInterval)
  }, [ping])

  return {
    send,
    ping,
    getStatus,
    reconnect: connect,
  }
}
