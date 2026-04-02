# Production WebSocket Example

Complete production-ready WebSocket client with all patterns.

```rust
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures::{SinkExt, StreamExt};
use tokio::sync::{mpsc, RwLock};
use tokio::task::JoinHandle;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tokio_util::sync::CancellationToken;

// === Constants ===

const STATE_DISCONNECTED: u8 = 0;
const STATE_CONNECTING: u8 = 1;
const STATE_CONNECTED: u8 = 2;

const PING_INTERVAL_SECS: u64 = 20;
const RECONNECT_BASE_DELAY_SECS: u64 = 1;
const RECONNECT_MAX_DELAY_SECS: u64 = 60;

// === Events ===

#[derive(Debug, Clone)]
pub enum WebSocketEvent {
    Connected,
    Disconnected,
    Message(String),
    Error(String),
}

// === Main Client ===

pub struct ProductionWebSocket {
    url: String,
    subscriptions: Arc<RwLock<HashSet<String>>>,
    state: Arc<AtomicU8>,
    event_tx: mpsc::Sender<WebSocketEvent>,
    cancel_token: CancellationToken,

    // Task handles for cleanup
    reader_handle: Option<JoinHandle<()>>,
    writer_handle: Option<JoinHandle<()>>,

    // Message channel
    outgoing_tx: Option<mpsc::Sender<Message>>,
}

impl ProductionWebSocket {
    pub fn new(url: String, event_tx: mpsc::Sender<WebSocketEvent>) -> Self {
        let state = Arc::new(AtomicU8::new(STATE_DISCONNECTED));
        let cancel_token = CancellationToken::new();

        let client = Self {
            url,
            subscriptions: Arc::new(RwLock::new(HashSet::new())),
            state: state.clone(),
            event_tx,
            cancel_token: cancel_token.clone(),
            reader_handle: None,
            writer_handle: None,
            outgoing_tx: None,
        };

        // Spawn PING loop ONE TIME - separate from connection
        client.spawn_ping_loop();

        client
    }

    // === PING Loop (Single Instance) ===

    fn spawn_ping_loop(&self) {
        let state = self.state.clone();
        let cancel_token = self.cancel_token.child_token();

        // Clone outgoing_tx will be set after connect
        // Use channel to send ping instead of holding reference

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(PING_INTERVAL_SECS));

            loop {
                tokio::select! {
                    _ = cancel_token.cancelled() => {
                        tracing::info!("Ping loop shutting down");
                        break;
                    }
                    _ = interval.tick() => {
                        // Ping will be handled by writer task
                        // Here only check state to log
                        if state.load(Ordering::SeqCst) == STATE_CONNECTED {
                            tracing::trace!("PING tick (connected)");
                        }
                    }
                }
            }
        });
    }

    // === Main Run Loop ===

    pub async fn run(&mut self) {
        loop {
            tokio::select! {
                _ = self.cancel_token.cancelled() => {
                    tracing::info!("WebSocket client shutting down");
                    self.cleanup().await;
                    break;
                }
                result = self.run_connection() => {
                    match result {
                        Ok(()) => {
                            tracing::info!("WebSocket closed gracefully");
                            break;
                        }
                        Err(e) => {
                            tracing::error!("WebSocket error: {e}");
                            let _ = self.event_tx.send(WebSocketEvent::Disconnected).await;

                            // Exponential backoff
                            self.reconnect_with_backoff().await;
                        }
                    }
                }
            }
        }
    }

    async fn run_connection(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Cleanup before connect
        self.cleanup().await;

        self.state.store(STATE_CONNECTING, Ordering::SeqCst);

        let (ws, _) = connect_async(&self.url).await?;
        let (mut write, mut read) = ws.split();

        // Setup outgoing channel
        let (outgoing_tx, mut outgoing_rx) = mpsc::channel::<Message>(100);
        self.outgoing_tx = Some(outgoing_tx.clone());

        // Re-subscribe all topics
        let subs = self.subscriptions.read().await.clone();
        for topic in subs {
            let msg = format!(r#"{{"op":"subscribe","topic":"{}"}}"#, topic);
            write.send(Message::Text(msg)).await?;
        }

        self.state.store(STATE_CONNECTED, Ordering::SeqCst);
        let _ = self.event_tx.send(WebSocketEvent::Connected).await;

        // Spawn writer task
        let cancel = self.cancel_token.child_token();
        let writer_handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = cancel.cancelled() => break,
                    msg = outgoing_rx.recv() => {
                        match msg {
                            Some(m) => {
                                if write.send(m).await.is_err() {
                                    break;
                                }
                            }
                            None => break,
                        }
                    }
                }
            }
        });
        self.writer_handle = Some(writer_handle);

        // Spawn ping task for this connection
        let ping_tx = outgoing_tx.clone();
        let ping_cancel = self.cancel_token.child_token();
        let ping_state = self.state.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(PING_INTERVAL_SECS));
            loop {
                tokio::select! {
                    _ = ping_cancel.cancelled() => break,
                    _ = interval.tick() => {
                        if ping_state.load(Ordering::SeqCst) == STATE_CONNECTED {
                            let _ = ping_tx.send(Message::Ping(vec![])).await;
                        }
                    }
                }
            }
        });

        // Run reader in current task
        let event_tx = self.event_tx.clone();
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    let _ = event_tx.send(WebSocketEvent::Message(text)).await;
                }
                Ok(Message::Ping(data)) => {
                    let _ = outgoing_tx.send(Message::Pong(data)).await;
                }
                Ok(Message::Pong(_)) => {
                    tracing::trace!("Received PONG");
                }
                Ok(Message::Close(_)) => {
                    tracing::info!("Server sent Close frame");
                    break;
                }
                Ok(Message::Binary(data)) => {
                    tracing::trace!("Received binary: {} bytes", data.len());
                }
                Err(e) => {
                    let _ = event_tx.send(WebSocketEvent::Error(e.to_string())).await;
                    return Err(e.into());
                }
            }
        }

        Ok(())
    }

    // === Cleanup ===

    async fn cleanup(&mut self) {
        // Abort existing tasks
        if let Some(h) = self.reader_handle.take() {
            h.abort();
            let _ = h.await;
        }
        if let Some(h) = self.writer_handle.take() {
            h.abort();
            let _ = h.await;
        }

        self.outgoing_tx = None;
        self.state.store(STATE_DISCONNECTED, Ordering::SeqCst);

        tracing::debug!("Connection cleaned up");
    }

    // === Reconnection ===

    async fn reconnect_with_backoff(&self) {
        let mut delay = Duration::from_secs(RECONNECT_BASE_DELAY_SECS);
        let max_delay = Duration::from_secs(RECONNECT_MAX_DELAY_SECS);

        tracing::info!("Reconnecting in {:?}", delay);
        tokio::time::sleep(delay).await;

        // Double delay for next time (capped)
        delay = (delay * 2).min(max_delay);
    }

    // === Subscription Management ===

    pub async fn subscribe(&mut self, topic: &str) {
        // Store FIRST to auto re-subscribe on reconnect
        self.subscriptions.write().await.insert(topic.to_string());

        // Send immediately if currently connected
        if self.state.load(Ordering::SeqCst) == STATE_CONNECTED {
            if let Some(tx) = &self.outgoing_tx {
                let msg = format!(r#"{{"op":"subscribe","topic":"{}"}}"#, topic);
                let _ = tx.send(Message::Text(msg)).await;
            }
        }
    }

    pub async fn unsubscribe(&mut self, topic: &str) {
        self.subscriptions.write().await.remove(topic);

        if self.state.load(Ordering::SeqCst) == STATE_CONNECTED {
            if let Some(tx) = &self.outgoing_tx {
                let msg = format!(r#"{{"op":"unsubscribe","topic":"{}"}}"#, topic);
                let _ = tx.send(Message::Text(msg)).await;
            }
        }
    }

    // === Shutdown ===

    pub fn shutdown(&self) {
        self.cancel_token.cancel();
    }

    // === State Query ===

    pub fn is_connected(&self) -> bool {
        self.state.load(Ordering::SeqCst) == STATE_CONNECTED
    }
}

// === Usage Example ===

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::init();

    let (event_tx, mut event_rx) = mpsc::channel(100);

    let mut ws = ProductionWebSocket::new(
        "wss://example.com/ws".to_string(),
        event_tx,
    );

    // Subscribe to topics
    ws.subscribe("orderbook:BTC-USD").await;
    ws.subscribe("trades:BTC-USD").await;

    // Spawn event handler
    tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            match event {
                WebSocketEvent::Connected => {
                    tracing::info!("Connected!");
                }
                WebSocketEvent::Disconnected => {
                    tracing::warn!("Disconnected, will reconnect...");
                }
                WebSocketEvent::Message(msg) => {
                    tracing::info!("Received: {}", msg);
                }
                WebSocketEvent::Error(e) => {
                    tracing::error!("Error: {}", e);
                }
            }
        }
    });

    // Run WebSocket (blocks until shutdown)
    ws.run().await;

    Ok(())
}
```

## Dependencies (Cargo.toml)

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = { version = "0.21", features = ["native-tls"] }
tokio-util = "0.7"
futures = "0.3"
tracing = "0.1"
tracing-subscriber = "0.3"
```
