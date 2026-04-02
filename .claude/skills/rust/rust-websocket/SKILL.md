---
name: rust-websocket
description: >
  Call this skill when implementing WebSocket client in Rust. Includes production-grade
  patterns for PING/keep-alive, reconnection with cleanup, interval task lifecycle,
  and subscription management. Focuses on long-running connections for trading bots.
invocation: auto
---

# WebSocket Production Patterns (Rust/Tokio)

## When to Use

- Implement WebSocket client/server
- Debug connection drops or reconnection issues
- Review WebSocket code
- Handle subscription management

---

## Quick Reference

### PING Mechanism Types

| Server Type | Mechanism | Client Action |
|-------------|-----------|---------------|
| Server sends PING | Auto | Reply PONG (tungstenite automatic) |
| Server expects client PING | Manual | Must send PING periodically |
| Server has heartbeat message | Manual | Parse and reply per format |
| No mechanism | Manual | Implement client-side PING |

**ALWAYS confirm mechanism with API docs BEFORE implementing.**

### Core Principles

| Principle | Rule |
|-----------|------|
| PING | Confirm mechanism before coding |
| Reconnection | MUST cleanup old connection completely |
| Subscriptions | Store for auto re-subscribe |
| Interval tasks | SEPARATE from connection lifecycle |

---

## Workflow

### 1. Before implementing

```
□ Confirm server PING mechanism (docs, test)
□ Determine reconnection behavior (server sends Close frame?)
□ Check rate limits (messages/sec, connections/IP)
```

### 2. Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│  WebSocketClient                                │
│  ├─ state: Arc<WebSocketState>                  │
│  ├─ subscriptions: Arc<RwLock<HashSet<String>>> │
│  └─ url: String                                 │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Spawned Tasks (SEPARATE)                       │
│  ├─ ping_loop: Single instance, check state     │
│  ├─ reader_task: Handle incoming messages       │
│  └─ writer_task: Handle outgoing messages       │
└─────────────────────────────────────────────────┘
```

### 3. Reconnection Flow

```
DETECT → CLEANUP → BACKOFF → CONNECT → RESUBSCRIBE → RESUME
   │         │         │         │          │           │
   │    Abort old   Exp delay  New WS    Load from    Normal
   │    tasks       1s→60s              stored subs   operation
   │    Clear state
```

### 4. Interval Task Pattern

```rust
// ✅ RIGHT: Single interval, check state
fn spawn_ping_loop(state: Arc<WebSocketState>) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(20)).await;
            if state.is_connected() {
                state.send_ping().await;
            }
        }
    });
}

// ❌ WRONG: Spawn in connect() → multiple intervals
```

---

## Code Review Checklist

```
□ Interval tasks NOT spawned in connect()?
□ Reconnect has old connection cleanup?
□ Subscriptions stored for re-subscribe?
□ Has exponential backoff?
□ State tracking (connected/connecting/disconnected)?
□ Graceful shutdown?
```

---

## Gotchas

See details: `gotchas.md`

| Anti-pattern | Issue | Fix |
|--------------|--------|-----|
| Spawn interval in connect() | Multiple intervals after reconnect | Single interval, check state |
| Do not abort old tasks | Resource leak | JoinHandle::abort() |
| Do not store subscriptions | Lost subs after reconnect | Store and re-subscribe |

---

## References

Read more details:
- `references/reconnection.md` - Detailed reconnection with code
- `references/interval-patterns.md` - Interval task patterns
- `references/production-example.md` - Full production code
- `gotchas.md` - Common failures and fixes
