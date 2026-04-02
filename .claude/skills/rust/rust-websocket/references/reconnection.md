# Reconnection Patterns

## Full Reconnection Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DETECT: Connection closed/error                         │
│                                                             │
│ 2. TERMINATE OLD (IMPORTANT):                               │
│    ├─ Close old WebSocket handle                            │
│    ├─ Abort old read/write tasks (JoinHandle::abort())      │
│    ├─ Clear pending messages queue                          │
│    └─ Reset connection state                                │
│                                                             │
│ 3. BACKOFF: Exponential delay (1s → 2s → 4s → ... → 60s)    │
│                                                             │
│ 4. CONNECT: Establish new WebSocket                         │
│                                                             │
│ 5. RE-SUBSCRIBE ALL TOPICS:                                 │
│    ├─ Load from stored subscriptions                        │
│    ├─ Send subscribe messages                               │
│    └─ Wait for confirmation (if any)                        │
│                                                             │
│ 6. RESUME: Normal operation                                 │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

```rust
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;

const STATE_DISCONNECTED: u8 = 0;
const STATE_CONNECTING: u8 = 1;
const STATE_CONNECTED: u8 = 2;

pub struct WebSocketManager {
    url: String,
    subscriptions: Arc<RwLock<HashSet<String>>>,
    ws_handle: Option<JoinHandle<()>>,
    state: Arc<AtomicU8>,
}

impl WebSocketManager {
    pub async fn reconnect(&mut self) -> Result<()> {
        // Step 2: TERMINATE OLD - REQUIRED
        self.cleanup_old_connection().await;

        // Step 3: BACKOFF
        let mut delay = Duration::from_secs(1);
        let max_delay = Duration::from_secs(60);

        loop {
            self.state.store(STATE_CONNECTING, Ordering::SeqCst);

            match self.connect_internal().await {
                Ok(ws) => {
                    // Step 5: RE-SUBSCRIBE
                    self.resubscribe_all(&ws).await?;

                    self.state.store(STATE_CONNECTED, Ordering::SeqCst);
                    tracing::info!("WebSocket reconnected successfully");
                    return Ok(());
                }
                Err(e) => {
                    tracing::warn!("Reconnect failed: {e}, retry in {:?}", delay);
                    tokio::time::sleep(delay).await;
                    delay = (delay * 2).min(max_delay);
                }
            }
        }
    }

    async fn cleanup_old_connection(&mut self) {
        // Abort old task
        if let Some(handle) = self.ws_handle.take() {
            handle.abort();
            let _ = handle.await; // Wait for abort to complete
        }

        self.state.store(STATE_DISCONNECTED, Ordering::SeqCst);
        tracing::debug!("Old connection cleaned up");
    }

    async fn resubscribe_all(&self, ws: &WebSocketStream) -> Result<()> {
        let subs = self.subscriptions.read().await;
        for topic in subs.iter() {
            let msg = format!(r#"{{"op":"subscribe","topic":"{}"}}"#, topic);
            ws.send(Message::Text(msg)).await?;
        }
        tracing::info!("Re-subscribed to {} topics", subs.len());
        Ok(())
    }
}
```

## Subscription Storage Pattern

```rust
impl WebSocketManager {
    /// Subscribe and store to auto re-subscribe on reconnect
    pub async fn subscribe(&self, topic: &str) -> Result<()> {
        // Store subscription BEFORE sending
        self.subscriptions.write().await.insert(topic.to_string());

        // Send subscribe message if currently connected
        if self.state.load(Ordering::SeqCst) == STATE_CONNECTED {
            self.send_subscribe(topic).await?;
        }
        // If not connected yet, will auto subscribe when reconnecting

        Ok(())
    }

    pub async fn unsubscribe(&self, topic: &str) -> Result<()> {
        // Remove from storage
        self.subscriptions.write().await.remove(topic);

        // Send unsubscribe if currently connected
        if self.state.load(Ordering::SeqCst) == STATE_CONNECTED {
            self.send_unsubscribe(topic).await?;
        }

        Ok(())
    }
}
```

## Exponential Backoff Helper

```rust
pub struct ExponentialBackoff {
    current: Duration,
    max: Duration,
    base: Duration,
}

impl ExponentialBackoff {
    pub fn new(base: Duration, max: Duration) -> Self {
        Self {
            current: base,
            max,
            base,
        }
    }

    pub fn next_delay(&mut self) -> Duration {
        let delay = self.current;
        self.current = (self.current * 2).min(self.max);
        delay
    }

    pub fn reset(&mut self) {
        self.current = self.base;
    }
}

// Usage
let mut backoff = ExponentialBackoff::new(
    Duration::from_secs(1),
    Duration::from_secs(60),
);

loop {
    match connect().await {
        Ok(_) => {
            backoff.reset();
            break;
        }
        Err(e) => {
            let delay = backoff.next_delay();
            tracing::warn!("Failed: {e}, retry in {:?}", delay);
            tokio::time::sleep(delay).await;
        }
    }
}
```
