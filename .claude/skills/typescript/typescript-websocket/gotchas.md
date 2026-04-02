# TypeScript WebSocket Gotchas

Common real-time communication mistakes in TypeScript for both NestJS backend and React frontend.

---

## 1. Not Cleaning Up WebSocket on React Component Unmount

### Problem

WebSocket connection stays open even after component unmounts, creating memory leaks and duplicated event handlers on remount.

```typescript
// WRONG: Memory leak — socket never cleaned up
function ChatWindow() {
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000/chat");
    ws.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };
    // NO CLEANUP — socket stays open when component unmounts
  }, []);

  return <div>{messages}</div>;
}

// CORRECT: Clean up socket on unmount
function ChatWindow() {
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000/chat");
    ws.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []);

  return <div>{messages}</div>;
}
```

### Why It Matters

- Multiple connections after component remount
- Memory leaks (sockets never garbage collected)
- Duplicate event handlers firing for same event
- Server resource exhaustion

---

## 2. Missing Reconnection Logic

### Problem

Single failed connection attempt loses real-time capability permanently. No automatic reconnection means user needs to refresh page.

```typescript
// WRONG: Connects once, never retries
function useWebSocket(url: string) {
  useEffect(() => {
    const ws = new WebSocket(url);
    ws.onopen = () => console.log("Connected");
    ws.onclose = () => console.log("Disconnected");
    // onclose just logs — no reconnection attempt
  }, [url]);
}

// CORRECT: Exponential backoff reconnection
function useWebSocket(url: string) {
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxAttempts = 5;

  const connect = useCallback(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      reconnectCountRef.current = 0; // Reset on successful connection
    };

    ws.onclose = () => {
      if (reconnectCountRef.current < maxAttempts) {
        const delay = Math.pow(2, reconnectCountRef.current) * 1000; // Exponential: 1s, 2s, 4s, 8s, 16s
        reconnectCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);
}
```

### Why It Matters

- Network glitches disconnect users permanently
- Poor user experience (page reload required)
- User data loss (messages not synced)

---

## 3. No Authentication on WebSocket Connection

### Problem

Unauthenticated WebSocket connections allow anyone to subscribe to any user's data. Security vulnerability.

```typescript
// WRONG: No authentication on connection
@WebSocketGateway()
export class NotificationsGateway {
  @SubscribeMessage("getData")
  handleGetData(socket: Socket, userId: string) {
    // Anyone can request any userId's data
    return this.userService.getPrivateData(userId);
  }
}

// CORRECT: Validate JWT on connection
@WebSocketGateway()
export class NotificationsGateway {
  constructor(private jwtService: JwtService) {}

  handleConnection(socket: Socket) {
    const token = socket.handshake.query.token as string | undefined;
    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      socket.data.userId = payload.sub; // Store authenticated user
    } catch (error) {
      socket.disconnect(true);
    }
  }

  @SubscribeMessage("getData")
  handleGetData(socket: Socket) {
    // Use authenticated userId from socket.data
    return this.userService.getPrivateData(socket.data.userId);
  }
}
```

### Why It Matters

- Data breach (unauthorized access to private data)
- No user isolation (users see each other's messages)
- Regulatory compliance (GDPR, SOC2)

---

## 4. Spawning Multiple Connections on Re-render

### Problem

Without useRef or missing dependency array, a new WebSocket is created on every render, exhausting resources.

```typescript
// WRONG: New connection on every render
function Dashboard() {
  const [messages, setMessages] = useState<string[]>([]);

  // This runs on EVERY render
  const ws = new WebSocket("ws://localhost:3000");
  ws.onmessage = (e) => setMessages((m) => [...m, e.data]);

  return <div>{messages.length} messages</div>;
}

// CORRECT: Single connection via useRef + useEffect
function Dashboard() {
  const [messages, setMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // This runs ONCE on mount
    if (!wsRef.current) {
      wsRef.current = new WebSocket("ws://localhost:3000");
      wsRef.current.onmessage = (e) =>
        setMessages((m) => [...m, e.data]);
    }

    return () => {
      wsRef.current?.close();
    };
  }, []); // Empty dependency = run once

  return <div>{messages.length} messages</div>;
}
```

### Why It Matters

- Resource leak (many open connections)
- Server crashes (too many concurrent connections)
- Duplicate messages (multiple listeners)

---

## 5. Not Validating Incoming WebSocket Messages

### Problem

Trust client-sent data without validation. Attacker sends malformed data, crashes server or corrupts state.

```typescript
// WRONG: Trust message format
@SubscribeMessage("updateProfile")
handleUpdateProfile(socket: Socket, data: any) {
  // data could be anything — no validation
  this.userService.update(data);
}

// CORRECT: Validate with Zod
import { z } from "zod";

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
});

@SubscribeMessage("updateProfile")
handleUpdateProfile(socket: Socket, data: unknown) {
  try {
    const validated = UpdateProfileSchema.parse(data);
    this.userService.update(socket.data.userId, validated);
    socket.emit("success");
  } catch (error) {
    socket.emit("error", { message: "Invalid data" });
  }
}
```

### Why It Matters

- Server crash (TypeError from unexpected types)
- Data corruption (invalid data saved to database)
- SQL injection / NoSQL injection (if not parameterized)
- Type safety lost

---

## 6. Missing Heartbeat / Ping Mechanism

### Problem

Connection silently drops (proxy timeout, network switch), but client doesn't know. Stuck in "connected" state sending messages to dead connection.

```typescript
// WRONG: No heartbeat — connection silently dies
function useWebSocket(url: string) {
  const [status, setStatus] = useState("connected");
  // No ping sent, no timeout detection
}

// CORRECT: Heartbeat with timeout detection
function useWebSocket(url: string) {
  const [status, setStatus] = useState("disconnected");
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);

    // If no pong within 45s, consider dead
    heartbeatTimeoutRef.current = setTimeout(() => {
      console.warn("No heartbeat, reconnecting...");
      wsRef.current?.close();
    }, 45000);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("connected");
      // Send ping every 30s
      pingIntervalRef.current = setInterval(() => {
        ws.send(JSON.stringify({ type: "ping" }));
      }, 30000);
      resetHeartbeat();
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "pong") {
        resetHeartbeat(); // Reset timeout on pong
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [url, resetHeartbeat]);
}
```

### Why It Matters

- Messages silently fail (user thinks data sent)
- Stale connection state (UI shows "connected" but connection is dead)
- User unaware of data loss

---

## 7. Lost Subscriptions After Reconnect

### Problem

Connection reconnects, but old subscriptions aren't re-sent to server. Client receives nothing after reconnect.

```typescript
// WRONG: Subscriptions lost on reconnect
function useWebSocketSubscriptions(url: string) {
  const subscriptionsRef = useRef<string[]>([]);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      // Only subscribe on initial connect, not reconnect
      subscriptionsRef.current.forEach((event) => {
        ws.send(JSON.stringify({ type: "subscribe", event }));
      });
    };

    ws.onclose = () => {
      // Reconnect happens (automatic), but subscriptions not re-sent
    };

    return () => ws.close();
  }, [url]);
}

// CORRECT: Re-subscribe on reconnect
function useWebSocketSubscriptions(url: string) {
  const subscriptionsRef = useRef<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const resubscribe = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      subscriptionsRef.current.forEach((event) => {
        wsRef.current?.send(JSON.stringify({ type: "subscribe", event }));
      });
    }
  }, []);

  const subscribe = useCallback((event: string) => {
    subscriptionsRef.current.push(event);
    resubscribe(); // Subscribe immediately if connected
  }, [resubscribe]);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      wsRef.current = ws;
      resubscribe(); // Re-subscribe on reconnect too
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => ws.close();
  }, [url, resubscribe]);

  return { subscribe };
}
```

### Why It Matters

- Data loss after network glitch
- User sees stale data (no updates)
- Inconsistent state (server thinks unsubscribed)

---

## 8. Unbounded Message Queue / No Backpressure

### Problem

Client sends messages faster than server processes them. Queue grows, memory explodes, connection freezes.

```typescript
// WRONG: Send without checking connection state
function useWebSocket(url: string) {
  const send = (data: unknown) => {
    // Send immediately, no state check
    ws.send(JSON.stringify(data));
  };

  return { send };
}

// CORRECT: Check state and implement rate limiting
function useWebSocket(url: string) {
  const sendQueueRef = useRef<unknown[]>([]);
  const sendRateLimitRef = useRef(0);

  const send = (data: unknown) => {
    // Only send if connected
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn("Not connected, queuing message");
      sendQueueRef.current.push(data);
      return;
    }

    // Rate limit: max 10 messages per second
    const now = Date.now();
    if (now - sendRateLimitRef.current < 100) {
      sendQueueRef.current.push(data);
      return;
    }

    wsRef.current.send(JSON.stringify(data));
    sendRateLimitRef.current = now;

    // Drain queue if not rate limited
    while (sendQueueRef.current.length > 0 && Date.now() - sendRateLimitRef.current >= 100) {
      const queuedData = sendQueueRef.current.shift();
      wsRef.current.send(JSON.stringify(queuedData));
      sendRateLimitRef.current = Date.now();
    }
  };

  return { send };
}
```

### Why It Matters

- Memory exhaustion (queue grows unbounded)
- Frozen UI (event loop blocked)
- Server resource exhaustion
- Message loss (when queue discarded)

---

## 9. Blocking Event Loop with Heavy Message Processing

### Problem

Processing large WebSocket messages blocks the event loop, freezing UI.

```typescript
// WRONG: Heavy processing blocks UI
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Heavy computation: convert, validate, transform 10k records
  const processed = hugeDataProcessing(data); // Blocks for 200ms
  setMessages((m) => [...m, ...processed]);
};

// CORRECT: Offload to Web Worker or defer with setTimeout
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Use queueMicrotask or setTimeout to defer processing
  queueMicrotask(() => {
    const processed = hugeDataProcessing(data);
    setMessages((m) => [...m, ...processed]);
  });
};

// Or use Web Worker for truly heavy work
const workerRef = useRef<Worker>(new Worker("message-processor.js"));

ws.onmessage = (event) => {
  // Offload to worker thread
  workerRef.current.postMessage(event.data);
};

workerRef.current.onmessage = (e) => {
  setMessages((m) => [...m, ...e.data]);
};
```

### Why It Matters

- UI freezes (unresponsive to user input)
- Animation jank (frames drop)
- Bad user experience

---

## 10. Not Handling Connection Errors Gracefully

### Problem

Connection error silently fails, no user feedback. User unaware of lost connection.

```typescript
// WRONG: Silent failure
function Dashboard() {
  const { messages } = useWebSocket("/api/notifications");
  return <div>{messages.length} notifications</div>;
}

// CORRECT: Show error feedback to user
function Dashboard() {
  const { messages, status, error } = useWebSocket("/api/notifications");

  if (error) {
    return (
      <div className="flex gap-2 items-center">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <span>Connection error: {error}</span>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const statusColor = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    disconnected: "bg-red-500",
  }[status];

  return (
    <div>
      <div className={`${statusColor} h-2 w-2 rounded-full`} />
      <span className="text-sm text-gray-500">{status}</span>
      <div>{messages.length} notifications</div>
    </div>
  );
}
```

### Why It Matters

- User unaware of data loss
- Silent failure mode (everything looks fine)
- Support burden (users report "app not working")

---

## 11. Using WebSocket for Data That Should Be REST + Polling

### Problem

WebSocket is overkill for infrequent updates. Adds complexity, memory, connection overhead.

```typescript
// WRONG: WebSocket for infrequent updates
function UserProfile() {
  const [user, setUser] = useState(null);
  const { onMessage } = useWebSocket("/api/user-updates");

  onMessage((data) => {
    setUser(data.user); // Update once per day?
  });
}

// CORRECT: Use React Query with polling interval
function UserProfile() {
  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api.get(`/user/${userId}`),
    refetchInterval: 60000, // Poll every 60s
  });
}
```

**Decision:** Use WebSocket if updates frequent (>1/sec), SSE if updates medium (1-10/min), polling if rare (<10/min).

### Why It Matters

- Unnecessary memory consumption (open socket)
- Increased server load (more connections)
- Complexity (heartbeat, reconnection, etc.)
- Polling is sufficient and simpler

---

## 12. Missing CORS Configuration on WebSocket Gateway

### Problem

Browser blocks WebSocket connection from different origin. CORS headers not sent.

```typescript
// WRONG: No CORS config
@WebSocketGateway()
export class NotificationsGateway {}

// In browser:
// WebSocket connection to 'ws://api.example.com' failed:
// Error during WebSocket handshake

// CORRECT: Configure CORS
@WebSocketGateway({
  cors: {
    origin: process.env["VITE_API_URL"] ?? "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
})
export class NotificationsGateway {}
```

### Why It Matters

- WebSocket connection fails in browser (but works in Postman)
- Local development broken (localhost:5173 vs localhost:3000)
- Production connection fails (different domains)
