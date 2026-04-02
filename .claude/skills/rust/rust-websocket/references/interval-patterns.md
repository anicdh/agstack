# Interval Task Patterns

## Core Principle

**Interval tasks MUST be separated from WebSocket lifecycle.**

Each reconnect should NOT create a new interval.

---

## Anti-Pattern: Spawn in connect()

```rust
// ❌ WRONG: Each reconnect creates ANOTHER interval
// After 5 reconnects = 5 PING intervals running in parallel!

async fn connect(&mut self) {
    let ws = connect_ws(&self.url).await?;

    // BAD: Spawn interval in connect
    tokio::spawn({
        let ws = ws.clone();
        async move {
            loop {
                ws.send(Message::Ping(vec![])).await;
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        }
    });
}
```

**Consequences:**
- Memory leak (tasks never stop)
- Many PINGs at the same time → server might rate limit
- Resource exhaustion after many reconnects

---

## Correct Pattern: Single Interval + State Check

```rust
pub struct WebSocketClient {
    state: Arc<WebSocketState>,
}

pub struct WebSocketState {
    sender: RwLock<Option<SplitSink<WebSocketStream, Message>>>,
    is_connected: AtomicBool,
}

impl WebSocketClient {
    pub fn new(url: String) -> Self {
        let state = Arc::new(WebSocketState {
            sender: RwLock::new(None),
            is_connected: AtomicBool::new(false),
        });

        // ✅ Spawn PING interval ONE TIME when creating client
        // DO NOT spawn in connect()
        Self::spawn_ping_loop(state.clone());

        Self { state }
    }

    fn spawn_ping_loop(state: Arc<WebSocketState>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(20));

            loop {
                interval.tick().await;

                // ✅ Only send PING if connected
                if state.is_connected.load(Ordering::SeqCst) {
                    if let Some(sender) = state.sender.write().await.as_mut() {
                        if let Err(e) = sender.send(Message::Ping(vec![])).await {
                            tracing::warn!("PING failed: {e}");
                            state.is_connected.store(false, Ordering::SeqCst);
                        }
                    }
                }
            }
        });
    }

    pub async fn connect(&self) -> Result<()> {
        let (ws, _) = connect_async(&self.url).await?;
        let (sender, receiver) = ws.split();

        // ✅ Update state - DO NOT spawn interval here
        *self.state.sender.write().await = Some(sender);
        self.state.is_connected.store(true, Ordering::SeqCst);

        // Spawn message handler
        self.spawn_message_handler(receiver);

        Ok(())
    }
}
```

---

## Alternative: Channel-based Approach

```rust
pub struct WebSocketClient {
    ping_tx: mpsc::Sender<()>,
    outgoing_tx: mpsc::Sender<Message>,
}

impl WebSocketClient {
    pub fn new() -> Self {
        let (outgoing_tx, outgoing_rx) = mpsc::channel(100);
        let (ping_tx, ping_rx) = mpsc::channel(1);

        // Single ping loop
        Self::spawn_ping_scheduler(ping_rx, outgoing_tx.clone());

        Self { ping_tx, outgoing_tx }
    }

    fn spawn_ping_scheduler(
        mut ping_rx: mpsc::Receiver<()>,
        outgoing_tx: mpsc::Sender<Message>,
    ) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(20));
            let mut enabled = false;

            loop {
                tokio::select! {
                    // Toggle signal
                    Some(()) = ping_rx.recv() => {
                        enabled = !enabled;
                    }
                    // Tick
                    _ = interval.tick() => {
                        if enabled {
                            let _ = outgoing_tx.send(Message::Ping(vec![])).await;
                        }
                    }
                }
            }
        });
    }

    pub async fn on_connected(&self) {
        // Enable ping
        let _ = self.ping_tx.send(()).await;
    }

    pub async fn on_disconnected(&self) {
        // Disable ping
        let _ = self.ping_tx.send(()).await;
    }
}
```

---

## Graceful Shutdown with CancellationToken

```rust
use tokio_util::sync::CancellationToken;

pub struct WebSocketClient {
    cancel_token: CancellationToken,
    state: Arc<WebSocketState>,
}

impl WebSocketClient {
    pub fn new() -> Self {
        let cancel_token = CancellationToken::new();
        let state = Arc::new(WebSocketState::default());

        // Spawn with cancellation support
        Self::spawn_ping_loop(
            state.clone(),
            cancel_token.child_token(),
        );

        Self { cancel_token, state }
    }

    fn spawn_ping_loop(state: Arc<WebSocketState>, token: CancellationToken) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(20));

            loop {
                tokio::select! {
                    // Cancellation
                    _ = token.cancelled() => {
                        tracing::info!("Ping loop shutting down");
                        break;
                    }
                    // Normal tick
                    _ = interval.tick() => {
                        if state.is_connected() {
                            state.send_ping().await;
                        }
                    }
                }
            }
        });
    }

    pub async fn shutdown(&self) {
        self.cancel_token.cancel();
    }
}
```

---

## Summary Table

| Pattern | Pros | Cons | When to use |
|---------|------|------|-------------|
| State check | Simple, clear | Polling overhead | Most cases |
| Channel toggle | No polling | More complex | Fine-grained control |
| CancellationToken | Clean shutdown | tokio_util dep | Production apps |
