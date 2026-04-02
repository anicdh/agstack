# WebSocket Gotchas

Common failures and how to fix them.

---

## 1. Multiple PING Intervals

**Symptom:** Server rate limits, many PING messages, memory gradually increases.

**Cause:** Spawn interval task in `connect()` function. Each reconnect creates an additional interval.

**Fix:**
```rust
// ❌ WRONG
async fn connect(&mut self) {
    let ws = connect_ws().await?;
    tokio::spawn(ping_loop(ws)); // Each connect = add 1 loop
}

// ✅ CORRECT
impl Client {
    fn new() -> Self {
        let state = Arc::new(State::default());
        Self::spawn_ping_loop(state.clone()); // ONE TIME
        Self { state }
    }
}
```

---

## 2. Old Connection Not Cleaned Up

**Symptom:** Resource leak, duplicate messages, inconsistent state.

**Cause:** Reconnect without aborting old tasks and clearing old state.

**Fix:**
```rust
async fn cleanup_old_connection(&mut self) {
    // MUST abort old tasks
    if let Some(handle) = self.reader_handle.take() {
        handle.abort();
        let _ = handle.await; // Wait for abort
    }
    if let Some(handle) = self.writer_handle.take() {
        handle.abort();
        let _ = handle.await;
    }

    // Clear state
    self.outgoing_tx = None;
    self.state.store(DISCONNECTED, Ordering::SeqCst);
}
```

---

## 3. Lost Subscriptions After Reconnect

**Symptom:** Not receiving data after reconnect, must manually re-subscribe.

**Cause:** Subscriptions not stored, only sent once when subscribed.

**Fix:**
```rust
pub async fn subscribe(&self, topic: &str) {
    // ✅ STORE FIRST
    self.subscriptions.write().await.insert(topic.to_string());

    // Send if connected
    if self.is_connected() {
        self.send_subscribe(topic).await;
    }
}

async fn on_reconnect(&self) {
    // ✅ Re-subscribe from stored
    let subs = self.subscriptions.read().await.clone();
    for topic in subs {
        self.send_subscribe(&topic).await;
    }
}
```

---

## 4. Wrong PING Mechanism

**Symptom:** Connection drops after 30-60s, "connection reset by peer".

**Cause:** Did not confirm PING mechanism of server, assumed wrong.

**Fix:**
```rust
// Binance: Server sends PING, client replies PONG (auto by tungstenite)
// Hyperliquid: No server PING, must send client PING every 20s
// Polymarket: Custom heartbeat message

// ✅ ALWAYS check docs and test first
match msg {
    Message::Ping(data) => {
        // Some servers use Ping frame
        ws.send(Message::Pong(data)).await?;
    }
    Message::Text(text) if text.contains("ping") => {
        // Some servers use text message
        ws.send(Message::Text(r#"{"op":"pong"}"#.into())).await?;
    }
}
```

---

## 5. Blocking in Async Context

**Symptom:** WebSocket lag, slow response, tokio runtime warning.

**Cause:** Using blocking operations in async task.

**Fix:**
```rust
// ❌ WRONG
async fn handle_message(msg: &str) {
    let parsed = serde_json::from_str(msg)?; // OK if small
    std::fs::write("log.txt", msg)?; // BLOCKING!
}

// ✅ CORRECT
async fn handle_message(msg: &str) {
    let parsed = serde_json::from_str(msg)?;
    tokio::fs::write("log.txt", msg).await?; // Async
}
```

---

## 6. Not Handling Close Frame

**Symptom:** Connection hangs, not triggering reconnect.

**Cause:** Not handling `Message::Close` properly.

**Fix:**
```rust
match msg {
    Message::Close(frame) => {
        tracing::info!("Server sent Close: {:?}", frame);
        // Return error to trigger reconnect
        return Err(WebSocketError::ServerClosed);
    }
    // ...
}
```

---

## 7. Unbounded Channel

**Symptom:** Memory gradually increases, OOM when server sends lots of data.

**Cause:** Using unbounded channel for outgoing/incoming messages.

**Fix:**
```rust
// ❌ WRONG
let (tx, rx) = mpsc::unbounded_channel();

// ✅ CORRECT
let (tx, rx) = mpsc::channel(100); // Bounded

// Handle backpressure
match tx.try_send(msg) {
    Ok(()) => {}
    Err(TrySendError::Full(_)) => {
        tracing::warn!("Channel full, dropping message");
    }
    Err(TrySendError::Closed(_)) => {
        return Err(Error::ChannelClosed);
    }
}
```

---

## 8. Race Condition on Reconnect

**Symptom:** Duplicate connections, inconsistent state.

**Cause:** Multiple reconnect attempts running in parallel.

**Fix:**
```rust
pub async fn reconnect(&self) -> Result<()> {
    // ✅ Use state machine
    let prev = self.state.compare_exchange(
        STATE_DISCONNECTED,
        STATE_CONNECTING,
        Ordering::SeqCst,
        Ordering::SeqCst,
    );

    match prev {
        Ok(_) => {
            // Proceed with reconnect
        }
        Err(STATE_CONNECTING) => {
            // Already reconnecting, skip
            return Ok(());
        }
        Err(STATE_CONNECTED) => {
            // Already connected, skip
            return Ok(());
        }
    }
}
```

---

## Checklist Review

When reviewing WebSocket code, check for the gotchas above:

```
□ Interval tasks spawn ONE TIME (not in connect)?
□ Old connection cleanup complete (abort + clear state)?
□ Subscriptions stored?
□ PING mechanism confirmed with docs?
□ No blocking operations?
□ Close frame handled?
□ Channels bounded?
□ Reconnect has state machine?
```
