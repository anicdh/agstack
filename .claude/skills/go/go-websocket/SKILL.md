---
name: go-websocket
description: WebSocket patterns for Go backends using Chi router and nhooyr.io/websocket. Use when adding real-time bidirectional communication, live updates, chat features, or collaborative editing.
invocation: auto
---

# Go WebSocket Skill

WebSocket patterns for Go backends using Chi router and `nhooyr.io/websocket`. Apply this skill when adding real-time features (chat, live updates, notifications, collaborative editing).

## Dependencies

```go
import (
    "nhooyr.io/websocket"
    "nhooyr.io/websocket/wsjson"  // JSON marshaling helper
)
```

Install:
```bash
go get nhooyr.io/websocket@latest
```

Why `nhooyr.io/websocket` over `gorilla/websocket`:
- Context-aware (respects cancellation)
- Fully RFC 6455 compliant
- Simpler API, fewer gotchas
- No separate mutex for concurrent writes

---

## Pattern 1: Connection Upgrade with Chi

Upgrade HTTP to WebSocket, authenticate, and assign to hub.

```go
// handler.go
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) error {
    // 1. Extract and validate auth token
    token := r.URL.Query().Get("token")
    if token == "" {
        token = extractBearerToken(r.Header.Get("Authorization"))
    }
    userID, err := h.auth.ValidateToken(token)
    if err != nil {
        return fmt.Errorf("invalid token: %w", err)
    }

    // 2. Upgrade connection
    conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
        InsecureSkipVerify: false,  // Verify Origin header in production
    })
    if err != nil {
        return fmt.Errorf("accept websocket: %w", err)
    }
    defer conn.Close(websocket.StatusInternalError, "internal error")

    // 3. Create client and add to hub
    client := &Client{
        ID:     userID,
        conn:   conn,
        send:   make(chan Message, 16),  // Buffered channel
        ctx:    r.Context(),
    }
    h.register <- client
    
    // 4. Start read/write pumps (non-blocking)
    go client.readPump(h)
    go client.writePump()

    return nil
}

func extractBearerToken(auth string) string {
    if len(auth) > 7 && auth[:7] == "Bearer " {
        return auth[7:]
    }
    return ""
}
```

Register in Chi router:
```go
r.Get("/ws", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if err := hub.HandleWebSocket(w, r); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
    }
}))
```

---

## Pattern 2: Hub/Room Pattern for Broadcast

Centralized hub manages connections, routes messages, handles registration.

```go
// hub.go
type Hub struct {
    clients    map[*Client]bool  // All connected clients
    broadcast  chan Message
    register   chan *Client
    unregister chan *Client
    mu         sync.RWMutex     // Protect clients map
    auth       AuthService
    ctx        context.Context
    cancel     context.CancelFunc
}

type Client struct {
    ID     string
    conn   *websocket.Conn
    send   chan Message
    ctx    context.Context
    cancel context.CancelFunc
}

type Message struct {
    Type      string      `json:"type"`      // "chat", "presence", "update"
    UserID    string      `json:"user_id"`
    Payload   interface{} `json:"payload"`
    Timestamp time.Time   `json:"timestamp"`
}

// NewHub creates and starts the hub
func NewHub(auth AuthService) *Hub {
    ctx, cancel := context.WithCancel(context.Background())
    h := &Hub{
        clients:    make(map[*Client]bool),
        broadcast:  make(chan Message, 64),
        register:   make(chan *Client),
        unregister: make(chan *Client),
        auth:       auth,
        ctx:        ctx,
        cancel:     cancel,
    }
    go h.run()
    return h
}

// run is the main hub event loop (single goroutine, no mutex needed)
func (h *Hub) run() {
    for {
        select {
        case <-h.ctx.Done():
            return
        
        case client := <-h.register:
            h.mu.Lock()
            h.clients[client] = true
            h.mu.Unlock()
            // Notify others of new user
            h.broadcast <- Message{
                Type:   "presence",
                UserID: client.ID,
                Payload: map[string]string{"event": "join"},
            }
        
        case client := <-h.unregister:
            h.mu.Lock()
            if ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)  // Unblock writePump
            }
            h.mu.Unlock()
            // Notify others
            h.broadcast <- Message{
                Type:   "presence",
                UserID: client.ID,
                Payload: map[string]string{"event": "leave"},
            }
        
        case msg := <-h.broadcast:
            h.mu.RLock()
            for client := range h.clients {
                // Non-blocking send (skip if client's buffer is full)
                select {
                case client.send <- msg:
                default:
                    // Client send channel full; skip or close
                }
            }
            h.mu.RUnlock()
        }
    }
}

// Graceful shutdown
func (h *Hub) Shutdown(ctx context.Context) error {
    h.mu.Lock()
    clients := make([]*Client, 0, len(h.clients))
    for client := range h.clients {
        clients = append(clients, client)
    }
    h.mu.Unlock()

    for _, client := range clients {
        client.conn.Close(websocket.StatusGoingAway, "server shutdown")
    }
    h.cancel()
    return nil
}
```

---

## Pattern 3: Read/Write Pumps with Goroutine Management

Separate goroutines for reading and writing prevent blocking.

```go
// Client read pump: receive messages from client, route to hub
func (c *Client) readPump(h *Hub) {
    defer func() {
        h.unregister <- c
        c.conn.Close(websocket.StatusInternalError, "read error")
    }()

    c.conn.SetReadLimit(32 * 1024)  // 32KB max message size
    c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    c.conn.SetPongHandler(func(string) error {
        c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
        return nil
    })

    for {
        var msg Message
        err := wsjson.Read(c.ctx, c.conn, &msg)
        if err != nil {
            if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
               websocket.CloseStatus(err) == websocket.StatusGoingAway {
                return
            }
            log.Printf("read error from %s: %v", c.ID, err)
            return
        }

        msg.UserID = c.ID
        msg.Timestamp = time.Now()
        h.broadcast <- msg
    }
}

// Client write pump: send messages from channel to client
func (c *Client) writePump() {
    ticker := time.NewTicker(30 * time.Second)
    defer func() {
        ticker.Stop()
        c.conn.Close(websocket.StatusInternalError, "write error")
    }()

    for {
        select {
        case <-c.ctx.Done():
            c.conn.Close(websocket.StatusGoingAway, "context cancelled")
            return
        
        case msg, ok := <-c.send:
            c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if !ok {
                // Hub closed send channel
                c.conn.Close(websocket.StatusNormalClosure, "")
                return
            }

            if err := wsjson.Write(c.ctx, c.conn, msg); err != nil {
                return
            }
        
        case <-ticker.C:
            c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if err := c.conn.Ping(c.ctx); err != nil {
                return
            }
        }
    }
}
```

---

## Pattern 4: Heartbeat with Ping/Pong

Built into write pump (Pattern 3). The 30-second ticker ensures the connection stays alive.

**Why it matters:** TCP connections can appear alive but actually be dead. Ping/pong detects stale connections.

**Client-side (TypeScript):**
```typescript
const ws = new WebSocket("ws://localhost:3000/ws?token=...");
ws.addEventListener("close", () => {
    // Reconnect with exponential backoff
    reconnect(1000);
});
```

---

## Pattern 5: Graceful Shutdown

Integrate with your HTTP server's shutdown hook.

```go
// main.go
srv := &http.Server{
    Addr:    ":3000",
    Handler: r,
}

go func() {
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
    <-sigChan

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    hub.Shutdown(ctx)
    srv.Shutdown(ctx)
}()

if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
    log.Fatal(err)
}
```

---

## Pattern 6: JSON Message Protocol with Discriminator

Typed messages use `type` field to route handler.

```go
// Client sends different message types
const (
    MessageTypeChat     = "chat"
    MessageTypePresence = "presence"
    MessageTypeUpdate   = "update"
)

type ChatMessage struct {
    Type    string `json:"type"`
    UserID  string `json:"user_id"`
    Content string `json:"content"`
}

type UpdateMessage struct {
    Type    string      `json:"type"`
    UserID  string      `json:"user_id"`
    Payload interface{} `json:"payload"`
}

// In readPump, route by type:
func (h *Hub) handleMessage(msg Message) {
    switch msg.Type {
    case MessageTypeChat:
        h.broadcast <- msg
    case MessageTypeUpdate:
        h.handleUpdate(msg)
    }
}
```

---

## Pattern 7: Authentication on Upgrade

See Pattern 1. Token validation happens before `websocket.Accept()`.

**Token sources (in order of precedence):**
1. Query param: `ws://host/ws?token=jwt_token`
2. Authorization header: `Authorization: Bearer jwt_token`

Always validate before accepting the connection.

---

## Pattern 8: Error Handling & Connection Close

Proper close codes prevent ambiguous disconnects.

```go
// Standard RFC 6455 close codes
const (
    NormalClosure    = 1000  // Normal close
    GoingAway        = 1001  // Endpoint going away (server restart)
    ProtocolError    = 1002  // Protocol violation
    InvalidData      = 1003  // Invalid message type
    TooMuchData      = 1009  // Message too large
    InternalError    = 1011  // Unexpected error
)

// In readPump, detect close reason:
err := wsjson.Read(c.ctx, c.conn, &msg)
if err != nil {
    code := websocket.CloseStatus(err)
    switch code {
    case websocket.StatusNormalClosure, websocket.StatusGoingAway:
        // Client or server closed normally
    case websocket.StatusInvalidUTF8:
        c.conn.Close(websocket.StatusInvalidData, "invalid UTF-8")
    default:
        log.Printf("close code: %d, reason: %v", code, err)
    }
    return
}
```

---

## Anti-Patterns Table

| ❌ Anti-Pattern | 💥 Symptom | ✅ Fix |
|---|---|---|
| Writing to conn from multiple goroutines | Race condition, corrupted frames | Use single writer goroutine, buffer channel |
| No ping/pong | Zombie connections, stale clients | Add ticker in write pump (Pattern 4) |
| Blocking read without timeout | Goroutine leak on disconnect | Use `SetReadDeadline()`, check context |
| Unbuffered send channel | Deadlock in hub.run() | Use `make(chan Message, 16)` |
| No message size limit | OOM on large payload | `SetReadLimit(32 * 1024)` |
| Closing same conn twice | Panic | Track close state with `sync.Once` or channel close |
| Ignoring context cancellation | Goroutine leak on shutdown | Check `c.ctx.Done()` in write pump |

---

## Before-Commit Checklist

- [ ] All client connections added to hub via `register` channel?
- [ ] Read/write pumps run in separate goroutines (non-blocking)?
- [ ] SetReadLimit and SetReadDeadline set in readPump?
- [ ] Ping ticker in writePump (Pattern 4)?
- [ ] Token validation before websocket.Accept()?
- [ ] Hub.run() handles register/unregister/broadcast with no deadlocks?
- [ ] Graceful shutdown triggers client.Close() for all clients?
- [ ] Send channels are buffered (not unbuffered)?
- [ ] No concurrent writes to conn (no mutex needed with single writePump)?
- [ ] Error handling covers all websocket.CloseStatus codes?
- [ ] Tested with `go test -race` to detect data races?

---

## References

- [nhooyr.io/websocket docs](https://pkg.go.dev/nhooyr.io/websocket)
- [RFC 6455 WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [Chi router middleware](https://pkg.go.dev/github.com/go-chi/chi/v5)
