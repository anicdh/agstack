# Go WebSocket Gotchas

Five common pitfalls and how to avoid them.

---

## Gotcha 1: Concurrent Writes to WebSocket Conn

### Symptom
- Random frame corruption in logs (`invalid frame opcode`)
- Garbled JSON messages in client console
- Connection drops unexpectedly
- Race detector warning: "write at 0x... concurrent with write"

### Cause
Multiple goroutines writing directly to `conn.Write()` or `wsjson.Write()` simultaneously without synchronization. WebSocket frames are not atomic at the HTTP/2 framing layer—concurrent writes interleave bytes and corrupt the stream.

### ❌ Wrong

```go
// Multiple goroutines calling wsjson.Write() directly
go func() {
    wsjson.Write(ctx, conn, msg1)  // Goroutine 1
}()
go func() {
    wsjson.Write(ctx, conn, msg2)  // Goroutine 2
}()
// Both write simultaneously → frame corruption
```

### ✅ Correct

Use a **single writer goroutine** with a buffered channel:

```go
// In Client struct
type Client struct {
    conn   *websocket.Conn
    send   chan Message  // All writes go through this channel
}

// Single writer goroutine (writePump)
func (c *Client) writePump() {
    for msg := range c.send {
        wsjson.Write(c.ctx, c.conn, msg)  // Only one goroutine writes
    }
}

// Other goroutines send via channel (non-blocking)
c.send <- msg  // Safe, no mutex needed
```

**Key:** `nhooyr.io/websocket` does NOT require a mutex for concurrent writes—use channels instead.

---

## Gotcha 2: Missing Ping/Pong (Zombie Connections)

### Symptom
- Client appears connected in server logs, but no messages are received
- Client perceives lag but never disconnects
- Network intermediary (firewall, load balancer) silently drops TCP without FIN
- Impossible to distinguish "user closed browser" from "network died"

### Cause
No heartbeat between client and server. TCP keep-alives are OS-level and unreliable at the application layer. WebSocket pings are application-level heartbeats that force a response, proving the connection is actually alive.

### ❌ Wrong

```go
func (c *Client) writePump() {
    for msg := range c.send {
        wsjson.Write(c.ctx, c.conn, msg)  // Only sends when there's data
    }
    // If no data → no writes → no way to detect dead connection
}
```

### ✅ Correct

Add a **ping ticker** in writePump:

```go
func (c *Client) writePump() {
    ticker := time.NewTicker(30 * time.Second)  // Send ping every 30s
    defer ticker.Stop()

    for {
        select {
        case msg, ok := <-c.send:
            if !ok {
                c.conn.Close(websocket.StatusNormalClosure, "")
                return
            }
            wsjson.Write(c.ctx, c.conn, msg)
        
        case <-ticker.C:
            if err := c.conn.Ping(c.ctx); err != nil {
                return  // Dead connection detected
            }
        }
    }
}

// In readPump, update deadline on pong:
c.conn.SetPongHandler(func(string) error {
    c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    return nil
})
```

**Result:** If server doesn't receive pong, readPump times out and closes connection cleanly.

---

## Gotcha 3: Goroutine Leak on Disconnect

### Symptom
- `ps aux` shows goroutine count growing over time
- Memory usage creeps up (no crash, just slow leak)
- After 1000 disconnects, 2000 goroutines still running
- Goroutine profiler shows dangling readPump/writePump goroutines

### Cause
Client registers but never unregisters from hub. Or readPump/writePump never exit because:
- No context cancellation
- Blocked on channel read (hub.unregister never called)
- No timeout on blocking operations

### ❌ Wrong

```go
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) error {
    conn, _ := websocket.Accept(w, r, nil)
    client := &Client{conn: conn, send: make(chan Message)}
    
    go client.readPump(h)
    go client.writePump()
    // Never explicitly unregister or close send channel
    return nil
}

// readPump
func (c *Client) readPump(h *Hub) {
    for {
        var msg Message
        wsjson.Read(c.ctx, c.conn, &msg)  // Blocks forever if conn is closed elsewhere
        // Never exits → goroutine leak
    }
}
```

### ✅ Correct

**Always unregister** on any exit path:

```go
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) error {
    conn, _ := websocket.Accept(w, r, nil)
    ctx, cancel := context.WithCancel(r.Context())
    client := &Client{
        conn:   conn,
        send:   make(chan Message, 16),
        ctx:    ctx,
        cancel: cancel,
    }
    
    h.register <- client
    go client.readPump(h)
    go client.writePump()
    return nil
}

// readPump with guaranteed cleanup
func (c *Client) readPump(h *Hub) {
    defer func() {
        h.unregister <- c  // ← Unregister on ANY exit
        c.conn.Close(websocket.StatusInternalError, "")
        c.cancel()
    }()

    for {
        var msg Message
        err := wsjson.Read(c.ctx, c.conn, &msg)
        if err != nil {
            return  // Defer unregisters
        }
        h.broadcast <- msg
    }
}

// writePump with cleanup
func (c *Client) writePump() {
    defer func() {
        c.conn.Close(websocket.StatusInternalError, "")
        c.cancel()
    }()
    
    for {
        select {
        case <-c.ctx.Done():
            return  // Defer cleans up
        case msg, ok := <-c.send:
            if !ok {
                return
            }
            wsjson.Write(c.ctx, c.conn, msg)
        }
    }
}

// In hub.run(), close send when unregistering
case client := <-h.unregister:
    if ok := h.clients[client]; ok {
        delete(h.clients, client)
        close(client.send)  // ← Unblock writePump
    }
```

**Rule:** Every goroutine must have a guaranteed exit path; use defer to ensure cleanup.

---

## Gotcha 4: Blocking Read Loop Prevents Graceful Shutdown

### Symptom
- Server shutdown times out after 5-10 seconds
- "Context deadline exceeded" in logs during graceful shutdown
- Goroutines still running after SIGTERM
- Client connections close abruptly instead of cleanly

### Cause
Read loop blocks on `wsjson.Read()` indefinitely. When hub.Shutdown() is called, it sends close messages but readPump never sees them because it's stuck waiting for the next message from client.

### ❌ Wrong

```go
func (c *Client) readPump(h *Hub) {
    for {
        var msg Message
        err := wsjson.Read(c.ctx, c.conn, &msg)  // Blocks until client sends
        if err != nil {
            return
        }
    }
    // If client is idle, this never unblocks → shutdown hangs
}
```

### ✅ Correct

Use `SetReadDeadline()` to force a timeout, and check context:

```go
func (c *Client) readPump(h *Hub) {
    defer func() {
        h.unregister <- c
        c.conn.Close(websocket.StatusInternalError, "")
    }()

    c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    
    for {
        select {
        case <-c.ctx.Done():
            return  // Context cancelled during shutdown
        default:
        }

        var msg Message
        err := wsjson.Read(c.ctx, c.conn, &msg)
        if err != nil {
            return
        }
        c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    }
}
```

**Or better:** Use context-aware read:

```go
// nhooyr.io/websocket respects context.Done()
err := c.conn.Read(c.ctx)  // Returns immediately if ctx is cancelled
```

**Result:** Shutdown calls hub.cancel() → c.ctx.Done() triggers → readPump exits cleanly.

---

## Gotcha 5: Large Message Without Size Limit (OOM)

### Symptom
- Server memory spikes to 100% after client sends large payload
- OOM killer terminates process
- Legitimate 32KB message is fine, but 512MB message crashes server
- No way to reject oversized messages

### Cause
WebSocket allows arbitrary message sizes. Without a limit, a malicious or buggy client can allocate unbounded memory by sending a frame with a huge length field.

### ❌ Wrong

```go
func (c *Client) readPump(h *Hub) {
    // No SetReadLimit() → no size check
    for {
        var msg Message
        wsjson.Read(c.ctx, c.conn, &msg)  // Can be 1GB
    }
}
```

### ✅ Correct

Set a **read limit** before reading:

```go
func (c *Client) readPump(h *Hub) {
    defer func() {
        h.unregister <- c
        c.conn.Close(websocket.StatusInternalError, "")
    }()

    c.conn.SetReadLimit(32 * 1024)  // 32KB max per message
    c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))

    for {
        var msg Message
        err := wsjson.Read(c.ctx, c.conn, &msg)
        if err != nil {
            if websocket.CloseStatus(err) == websocket.StatusMessageTooBig {
                c.conn.Close(websocket.StatusMessageTooBig, "message too large")
            }
            return
        }
        c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    }
}
```

**Recommended limits:**
- Text messages (JSON): 32–64 KB
- Binary payloads: 1–10 MB
- Depends on use case (chat vs. file transfer)

**Result:** Client sending > 32KB gets `StatusMessageTooBig` close code; server memory stays safe.

---

## Testing Checklist

```bash
# Run race detector
go test -race ./...

# Profile goroutine count
go tool pprof http://localhost:6060/debug/pprof/goroutine

# Load test
ab -n 1000 -c 100 http://localhost:3000/health
wrk -t4 -c100 -d30s ws://localhost:3000/ws?token=test

# Monitor memory
watch -n 1 'ps aux | grep myapp'
```
