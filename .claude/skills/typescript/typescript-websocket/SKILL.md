---
name: typescript-websocket
description: >
  Call this skill when implementing real-time communication in TypeScript:
  WebSocket servers (NestJS Gateway/Socket.io), WebSocket clients (React),
  Server-Sent Events (SSE), reconnection logic, or subscription management.
  Covers production patterns for both backend and frontend real-time features.
invocation: auto
---

# TypeScript WebSocket & Real-Time Communication

## When to Use

- Implement WebSocket server (NestJS Gateway with Socket.io)
- Implement WebSocket client (React useWebSocket hook)
- Build Server-Sent Events (SSE) for server-to-client streaming
- Debug connection drops, reconnection issues, message loss
- Review real-time code for production readiness
- Manage subscriptions and subscription cleanup

---

## Quick Decision: WebSocket vs SSE vs Polling

| Need | Technology | Use Case | Complexity |
|------|-----------|----------|-----------|
| Bidirectional, low latency | WebSocket (Socket.io) | Chat, live collaboration, gaming, live updates | Medium |
| Server→Client only, simple | SSE (EventSource) | Notifications, live feed, progress streams | Low |
| Request-Response + subscribe | WebSocket + React Query | Dashboard real-time with query invalidation | Medium |
| Infrequent updates | REST + React Query `refetchInterval` | Once per minute or slower | Low |

**Decision Tree:**
```
Need server→client AND client→server?
├─ YES → WebSocket (Socket.io for ease, native WebSocket for control)
├─ NO, server→client only?
│   └─ SSE (EventSource) — simpler, built-in reconnection
└─ NO, polling acceptable?
    └─ React Query with refetchInterval
```

---

## NestJS WebSocket Gateway (Socket.io)

Socket.io is the recommended approach for NestJS (built-in support via `@nestjs/websockets`).

### Basic Gateway Setup

```typescript
// src/modules/notifications/notifications.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { UseGuards, Injectable } from "@nestjs/common";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  namespace: "/notifications",
  cors: {
    origin: process.env["VITE_API_URL"] ?? "http://localhost:5173",
    credentials: true,
  },
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger = new Logger("NotificationsGateway");

  // Handler when client connects
  handleConnection(socket: Socket): void {
    this.logger.log(`Client connected: ${socket.id}`);
  }

  // Handler when client disconnects
  handleDisconnect(socket: Socket): void {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  // Message handler: client sends 'message', server responds
  @SubscribeMessage("message")
  handleMessage(socket: Socket, data: string): void {
    this.logger.log(`Message from ${socket.id}: ${data}`);
    socket.emit("response", { status: "received" });
  }

  // Server broadcasts to all clients
  broadcastNotification(message: { type: string; data: unknown }): void {
    this.server.emit("notification", message);
  }

  // Server broadcasts to room
  broadcastToRoom(roomName: string, event: string, data: unknown): void {
    this.server.to(roomName).emit(event, data);
  }
}
```

### Authentication on WebSocket Connection

**CRITICAL:** Validate JWT on connection, NOT on individual messages.

```typescript
// src/modules/notifications/notifications.gateway.ts
import { WsException } from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";

@WebSocketGateway({
  namespace: "/notifications",
  cors: {
    origin: process.env["VITE_API_URL"] ?? "http://localhost:5173",
    credentials: true,
  },
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger = new Logger("NotificationsGateway");

  constructor(private jwtService: JwtService) {}

  // ✅ CORRECT: Authenticate on connection
  async handleConnection(socket: Socket): Promise<void> {
    try {
      // Token in handshake query: socket.handshake.query.token
      const token = socket.handshake.query.token as string | undefined;
      if (!token) {
        throw new WsException("Unauthorized: missing token");
      }

      const payload = this.jwtService.verify(token);
      // Store userId in socket data for later use
      socket.data.userId = payload.sub;
      socket.data.username = payload.username;

      // Join room for this user (for targeted messages)
      socket.join(`user:${payload.sub}`);

      this.logger.log(`User ${payload.sub} connected: ${socket.id}`);
    } catch (error) {
      this.logger.warn(`Auth failed: ${error instanceof Error ? error.message : "unknown error"}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.log(
      `User ${socket.data.userId as string | undefined} disconnected: ${socket.id}`
    );
  }

  @SubscribeMessage("message")
  handleMessage(
    socket: Socket,
    data: { text: string }
  ): void {
    const userId = socket.data.userId as string;
    this.logger.log(`Message from user ${userId}: ${data.text}`);

    // Broadcast to all clients in user's room
    this.server.to(`user:${userId}`).emit("messageReceived", {
      text: data.text,
      userId,
      timestamp: new Date(),
    });
  }
}
```

### Room Management: Join/Leave

```typescript
@SubscribeMessage("joinRoom")
handleJoinRoom(socket: Socket, roomName: string): void {
  socket.join(roomName);
  // Notify others in room
  socket.broadcast
    .to(roomName)
    .emit("userJoined", {
      userId: socket.data.userId,
      username: socket.data.username,
    });
}

@SubscribeMessage("leaveRoom")
handleLeaveRoom(socket: Socket, roomName: string): void {
  socket.leave(roomName);
  socket.broadcast
    .to(roomName)
    .emit("userLeft", {
      userId: socket.data.userId,
    });
}
```

### Error Handling in Gateway

```typescript
@SubscribeMessage("performAction")
handlePerformAction(socket: Socket, data: { actionId: string }): void {
  try {
    // Your business logic
    if (!data.actionId) {
      throw new WsException("Missing actionId");
    }

    // Send success response back to sender
    socket.emit("actionComplete", { success: true });
  } catch (error) {
    // Send error ONLY to sender, not broadcast
    socket.emit("error", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    this.logger.error(`Action failed for user ${socket.data.userId as string}`, error);
  }
}
```

---

## NestJS Server-Sent Events (SSE)

Use SSE for server→client only, unidirectional updates (notifications, progress, live feed).

### Basic SSE Controller

```typescript
// src/modules/notifications/notifications.controller.ts
import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";
import { Response } from "express";
import { Subject, Observable } from "rxjs";

@Controller("notifications")
export class NotificationsController {
  private notificationSubjects = new Map<string, Subject<string>>();

  // ✅ CORRECT: SSE endpoint with auth
  @Get("stream")
  @UseGuards(JwtAuthGuard)
  stream(@CurrentUser() userId: string, @Res() res: Response): void {
    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Create stream for this user
    const subject = new Subject<string>();
    this.notificationSubjects.set(userId, subject);

    // Send client a comment (keeps connection alive)
    res.write(": connected\n\n");

    // Subscribe to events
    const subscription = subject.subscribe({
      next: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      error: (error) => {
        this.notificationSubjects.delete(userId);
        res.end();
      },
      complete: () => {
        this.notificationSubjects.delete(userId);
        res.end();
      },
    });

    // Clean up on client disconnect
    res.on("close", () => {
      subscription.unsubscribe();
      this.notificationSubjects.delete(userId);
    });
  }

  // Method to send notification to specific user (from elsewhere in app)
  sendNotification(
    userId: string,
    message: { type: string; data: unknown }
  ): void {
    const subject = this.notificationSubjects.get(userId);
    if (subject) {
      subject.next(message);
    }
  }
}
```

### SSE with Typed Events

```typescript
// src/modules/notifications/dto/notification-event.ts
import { z } from "zod";

const NotificationEventSchema = z.union([
  z.object({
    type: z.literal("orderUpdate"),
    data: z.object({
      orderId: z.string(),
      status: z.string(),
      timestamp: z.string(),
    }),
  }),
  z.object({
    type: z.literal("message"),
    data: z.object({
      from: z.string(),
      text: z.string(),
      timestamp: z.string(),
    }),
  }),
]);

export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

// In controller
sendNotification(userId: string, message: NotificationEvent): void {
  const subject = this.notificationSubjects.get(userId);
  if (subject) {
    // Validation ensures type safety
    const validated = NotificationEventSchema.parse(message);
    subject.next(JSON.stringify(validated));
  }
}
```

---

## React WebSocket Client Hook

### Basic useWebSocket Hook

```typescript
// src/hooks/use-websocket.ts
import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected";

export function useWebSocket({
  url,
  onMessage,
  onError,
  onOpen,
  onClose,
  reconnectAttempts = 5,
  reconnectInterval = 1000,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ CORRECT: Exponential backoff with jitter
  const calculateBackoff = useCallback((attempt: number): number => {
    const baseDelay = reconnectInterval;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const maxDelay = 30000; // 30 seconds max
    const jitter = Math.random() * 1000; // 0-1s random jitter
    return Math.min(exponentialDelay + jitter, maxDelay);
  }, [reconnectInterval]);

  const connect = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setStatus("connecting");
    setError(null);

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setStatus("connected");
        setError(null);
        reconnectCountRef.current = 0;
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (e) {
          setError("Failed to parse message");
        }
      };

      ws.onerror = (event) => {
        setError("WebSocket error");
        onError?.(event);
      };

      ws.onclose = () => {
        setStatus("disconnected");
        onClose?.();

        // Attempt reconnection
        if (reconnectCountRef.current < reconnectAttempts) {
          const delay = calculateBackoff(reconnectCountRef.current);
          reconnectCountRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError("Max reconnection attempts reached");
        }
      };

      websocketRef.current = ws;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setStatus("disconnected");
    }
  }, [url, onMessage, onError, onOpen, onClose, reconnectAttempts, calculateBackoff]);

  // ✅ CORRECT: Clean up on unmount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      websocketRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(data));
    } else {
      setError("WebSocket not connected");
    }
  }, []);

  return {
    status,
    error,
    send,
  };
}
```

### useWebSocket with Subscriptions

```typescript
// src/hooks/use-websocket-subscriptions.ts
interface Subscription {
  event: string;
  handler: (data: unknown) => void;
}

export function useWebSocketSubscriptions(url: string) {
  const subscriptionsRef = useRef<Subscription[]>([]);

  const { status, error, send } = useWebSocket({
    url,
    onMessage: (data) => {
      const message = data as { event: string; payload: unknown };
      // Find all handlers for this event
      subscriptionsRef.current
        .filter((sub) => sub.event === message.event)
        .forEach((sub) => sub.handler(message.payload));
    },
  });

  const subscribe = useCallback(
    (event: string, handler: (data: unknown) => void) => {
      subscriptionsRef.current.push({ event, handler });

      // Notify server of subscription
      send({ type: "subscribe", event });

      // Return unsubscribe function
      return () => {
        subscriptionsRef.current = subscriptionsRef.current.filter(
          (sub) => !(sub.event === event && sub.handler === handler)
        );
        send({ type: "unsubscribe", event });
      };
    },
    [send]
  );

  return {
    status,
    error,
    subscribe,
  };
}
```

### useWebSocket with React Query Integration

```typescript
// src/hooks/use-websocket-query.ts
import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "./use-websocket";

export function useWebSocketQuery(url: string) {
  const queryClient = useQueryClient();

  return useWebSocket({
    url,
    onMessage: (data) => {
      const message = data as { event: string; queryKey: string[]; payload: unknown };

      // Invalidate React Query cache when WebSocket message arrives
      if (message.event === "dataUpdate") {
        queryClient.invalidateQueries({
          queryKey: message.queryKey,
        });
      }

      // Or update cache directly (more efficient)
      if (message.event === "dataUpdated") {
        queryClient.setQueryData(message.queryKey, message.payload);
      }
    },
  });
}

// Usage in component:
function OrderDashboard() {
  const queryClient = useQueryClient();
  useWebSocketQuery("/api/notifications");

  const { data: orders } = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: () => api.get("/orders"),
  });

  // When WebSocket emits "dataUpdated" with queryKey ["orders", "all"],
  // React Query automatically updates this component
}
```

### useWebSocket with Zustand Integration

```typescript
// src/hooks/use-websocket-store.ts
import { useShallow } from "zustand/react";
import { useNotificationStore } from "@/stores/notification-store";

export function useWebSocketStore(url: string) {
  const addNotification = useNotificationStore(
    useShallow((state) => state.addNotification)
  );

  return useWebSocket({
    url,
    onMessage: (data) => {
      const message = data as { type: string; payload: unknown };

      if (message.type === "notification") {
        const payload = message.payload as { id: string; title: string; message: string };
        addNotification({
          id: payload.id,
          title: payload.title,
          message: payload.message,
        });
      }
    },
  });
}
```

---

## React EventSource (SSE) Client Hook

For server→client only communication (notifications, progress).

### Basic useEventSource Hook

```typescript
// src/hooks/use-event-source.ts
import { useEffect, useRef, useState, useCallback } from "react";

interface UseEventSourceOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  onError?: (error: Event) => void;
  headers?: Record<string, string>;
}

export function useEventSource({
  url,
  onMessage,
  onError,
  headers,
}: UseEventSourceOptions) {
  const [status, setStatus] = useState<"connected" | "disconnected">("disconnected");
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // ✅ CORRECT: EventSource handles auto-reconnection
    // No need for manual reconnection logic
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setStatus("connected");
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch (e) {
        setError("Failed to parse message");
      }
    };

    eventSource.onerror = (event) => {
      setStatus("disconnected");
      setError("EventSource error");
      onError?.(event);
      // EventSource automatically attempts reconnection
    };

    eventSourceRef.current = eventSource;

    // ✅ CORRECT: Clean up on unmount
    return () => {
      eventSource.close();
    };
  }, [url, onMessage, onError]);

  return { status, error };
}
```

### useEventSource with Typed Events

```typescript
// src/hooks/use-event-source-typed.ts
import { useEventSource } from "./use-event-source";
import { useCallback } from "react";

type EventHandler<T> = (data: T) => void;

export function useEventSourceTyped<T extends { type: string }>(
  url: string,
  handlers: Record<string, EventHandler<unknown>>
) {
  const handleMessage = useCallback(
    (data: unknown) => {
      const message = data as T;
      const handler = handlers[message.type];
      if (handler) {
        handler(data);
      }
    },
    [handlers]
  );

  return useEventSource({
    url,
    onMessage: handleMessage,
  });
}

// Usage:
function NotificationCenter() {
  useEventSourceTyped("/api/notifications/stream", {
    orderUpdate: (data) => {
      console.log("Order updated:", data);
    },
    message: (data) => {
      console.log("New message:", data);
    },
  });

  return <div>Listening for notifications...</div>;
}
```

---

## Heartbeat / Keep-Alive

Prevent silent connection drops.

### WebSocket Client Heartbeat

```typescript
// src/hooks/use-websocket-with-heartbeat.ts
export function useWebSocketWithHeartbeat(
  url: string,
  heartbeatInterval = 30000 // 30 seconds
) {
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = setTimeout(() => {
      console.warn("No heartbeat received, triggering reconnect");
      // Force reconnect by closing socket
      websocketRef.current?.close();
    }, heartbeatInterval * 1.5); // 1.5x interval before timeout
  }, [heartbeatInterval]);

  const { status, error, send } = useWebSocket({
    url,
    onOpen: () => {
      // Start heartbeat on connect
      const pingInterval = setInterval(() => {
        send({ type: "ping" });
      }, heartbeatInterval);

      return () => clearInterval(pingInterval);
    },
    onMessage: (data) => {
      const message = data as { type: string };
      if (message.type === "pong") {
        resetHeartbeat();
      }
    },
  });

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    };
  }, []);

  return { status, error, send };
}
```

### NestJS Gateway Heartbeat

```typescript
@WebSocketGateway()
@Injectable()
export class NotificationsGateway {
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();

  handleConnection(socket: Socket): void {
    // Start heartbeat for this connection
    const interval = setInterval(() => {
      socket.emit("ping");
    }, 30000);
    this.heartbeatIntervals.set(socket.id, interval);
  }

  handleDisconnect(socket: Socket): void {
    const interval = this.heartbeatIntervals.get(socket.id);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(socket.id);
    }
  }

  @SubscribeMessage("pong")
  handlePong(socket: Socket): void {
    this.logger.debug(`Pong from ${socket.id}`);
  }
}
```

---

## Message Patterns

### Typed Message Envelope

```typescript
// src/shared/types/websocket-message.ts
import { z } from "zod";

const WebSocketMessageSchema = z.object({
  id: z.string().uuid().optional(),
  event: z.string(),
  data: z.unknown(),
  timestamp: z.string().datetime(),
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// Validation helper
export function validateMessage(data: unknown): WebSocketMessage {
  return WebSocketMessageSchema.parse(data);
}
```

### Acknowledgment Pattern (Socket.io)

```typescript
// Backend
@SubscribeMessage("updateData")
handleUpdateData(socket: Socket, data: { id: string }, callback: Function): void {
  try {
    const result = this.processUpdate(data.id);
    callback({ success: true, result });
  } catch (error) {
    callback({ success: false, error: error instanceof Error ? error.message : "Unknown" });
  }
}

// Frontend
const { send } = useWebSocket(url);

// Send message with callback
socket.emit("updateData", { id: "123" }, (response: { success: boolean }) => {
  if (response.success) {
    console.log("Update acknowledged");
  }
});
```

---

## Production Checklist

Before deploying real-time features:

- [ ] **Authentication on connection?** Token validated on WebSocket/SSE handshake, not per-message
- [ ] **Reconnection with exponential backoff?** Max 5 attempts, starting 1s, capped at 30s
- [ ] **Subscriptions restored on reconnect?** Stored in hook/store, re-sent after connection
- [ ] **Heartbeat/ping mechanism?** 30s interval, timeout if no pong after 45s
- [ ] **Proper cleanup on unmount?** useEffect cleanup closes socket, clears timers
- [ ] **Message validation?** All incoming messages validated with Zod
- [ ] **Rate limiting on server?** Max messages/sec per connection
- [ ] **Error handling for connection failures?** Graceful degradation, user feedback
- [ ] **Logging for connection lifecycle events?** connect, disconnect, reconnect, error
- [ ] **Memory leaks prevented?** useRef for socket, cleanup timers, unsubscribe handlers
- [ ] **Graceful degradation?** App still works if real-time unavailable (fallback to polling)
- [ ] **No sensitive data in messages?** Never send tokens, passwords, PII over WebSocket
- [ ] **CORS configured correctly?** Origins whitelist, credentials: true if needed
- [ ] **Load testing done?** Can handle expected concurrent connections?
- [ ] **Monitoring in place?** Alerts for connection drop rate, message throughput
