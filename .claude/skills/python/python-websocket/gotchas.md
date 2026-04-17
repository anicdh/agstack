# FastAPI WebSocket Gotchas

## 1. Missing `WebSocketDisconnect` Exception Handler — Server Crashes

**Symptom:** Client closes connection → server crashes with uncaught `WebSocketDisconnect` exception; logs show error in `/ws` endpoint.

```python
# ❌ WRONG — no disconnect handler
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    while True:
        data = await websocket.receive_text()  # Raises WebSocketDisconnect when client closes
        # No try-except → exception bubbles up → server crash
        await websocket.send_text(f"Echo: {data}")

# Client closes → server logs:
# ERROR: Uncaught exception in WebSocket
# fastapi.websocket.WebSocketDisconnect: [Errno 1000]
```

**Cause:** `websocket.receive_text()` raises `WebSocketDisconnect` when client closes connection. Without try-except, exception crashes the handler.

**Fix:** Wrap receive/send in try-except block.

```python
# ✅ CORRECT — with disconnect handler
from fastapi import WebSocketDisconnect

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        logger.info("Client disconnected")
        # Now it's handled gracefully
```

---

## 2. Blocking Operations in WebSocket Handler — Event Loop Freeze

**Symptom:** One client's action (long operation) blocks all other clients; responses slow down dramatically for everyone.

```python
# ❌ WRONG — blocking operation in handler
import time

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            
            # CPU-bound operation that blocks for 10 seconds
            time.sleep(10)  # BLOCKS entire event loop!
            
            await websocket.send_text(f"Processed: {data}")
    except WebSocketDisconnect:
        pass

# If 5 clients send messages:
# - Client 1 blocks event loop for 10 seconds
# - Clients 2-5 wait for Client 1's sleep to finish
# - All clients experience 50 second delay (5 * 10)
```

**Cause:** Sync blocking I/O (time.sleep, requests.get, time.time() in loop) blocks the async event loop, preventing other coroutines from running.

**Fix:** Use async version of every I/O operation.

```python
# ✅ CORRECT — async operations
import asyncio
import httpx

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            
            # Async sleep — yields to event loop
            await asyncio.sleep(10)
            
            await websocket.send_text(f"Processed: {data}")
    except WebSocketDisconnect:
        pass

# ✅ Async HTTP
async def fetch_data(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)  # Non-blocking
        return response.json()
```

---

## 3. No Connection Cleanup on Disconnect — Memory Leak

**Symptom:** Server memory usage grows over time; connection manager's internal dict keeps references to disconnected clients; RAM never reclaimed.

```python
# ❌ WRONG — no cleanup
class BadConnectionManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []
    
    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.append(websocket)  # Added but never removed
    
    # No disconnect method!

manager = BadConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            for conn in manager.connections:
                await conn.send_text(data)
    except WebSocketDisconnect:
        pass
        # Connection never removed from manager.connections
        # Memory leak: dead WebSocket objects stay in list forever

# After 1000 client disconnects:
# manager.connections has 1000 dead references
# Server RAM never freed
```

**Cause:** Connection manager stores references to WebSocket objects but never removes them on disconnect.

**Fix:** Explicitly remove disconnected connections in finally block.

```python
# ✅ CORRECT — cleanup on disconnect
class GoodConnectionManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []
    
    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket) -> None:
        """Remove connection from tracking."""
        self.connections.remove(websocket)

manager = GoodConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            for conn in manager.connections:
                await conn.send_text(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)  # ← Cleanup happens
```

---

## 4. Broadcasting to Dead Connections — Silent Failures Accumulate

**Symptom:** Broadcast operation fails silently for some clients; over time, more clients get skipped; nobody knows why messages stop arriving.

```python
# ❌ WRONG — no error handling during broadcast
class BadManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []
    
    async def broadcast(self, message: str) -> None:
        for connection in self.connections:
            # If connection is dead, exception raised but not caught
            # Remaining connections in the loop are never reached
            await connection.send_text(message)

# Scenario:
# - connections = [alive1, dead_client, alive2, alive3]
# - broadcast("hello") tries alive1 ✓
# - tries dead_client ✗ exception raised
# - alive2 and alive3 never receive message
# - exception bubbles up, broadcast fails
```

**Cause:** One dead connection in the list causes the broadcast to fail for all remaining connections.

**Fix:** Track and remove dead connections during broadcast.

```python
# ✅ CORRECT — remove dead connections during broadcast
class GoodManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []
    
    async def broadcast(self, message: str) -> None:
        dead_connections: list[WebSocket] = []
        for connection in self.connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Failed to send to connection: {e}")
                dead_connections.append(connection)
        
        # Remove all dead connections
        for dead in dead_connections:
            self.connections.remove(dead)

# Now:
# - alive1 receives ✓
# - dead_client fails but is marked for removal
# - alive2 and alive3 still receive ✓
# - dead_client is removed from list
```

---

## 5. No Authentication Before Accept — Unauthorized Connection Established

**Symptom:** Unauthenticated user connects to WebSocket before token is validated; security check happens after connection already open.

```python
# ❌ WRONG — accept before validating token
import jwt

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str) -> None:
    # Connection is OPEN to anyone right now
    await websocket.accept()  # Accept happens BEFORE validation
    
    try:
        # Now validate token
        payload = jwt.decode(token, "secret", algorithms=["HS256"])
        user_id = payload.get("sub")
    except jwt.InvalidTokenError:
        # Token is invalid, but connection already accepted
        # Attacker is already connected
        await websocket.close()  # Too late, closing an open connection
        return
    
    # Only after this point is the connection trusted
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(data)

# Timeline:
# T=0: Attacker sends request with invalid token
# T=1: Server accepts connection (OPEN)
# T=2: Server validates token, finds it invalid
# T=3: Server closes connection
# → Attacker had open WebSocket between T=1 and T=3
```

**Cause:** Calling `await websocket.accept()` before validating auth credentials opens the connection to anyone.

**Fix:** Validate credentials BEFORE accept.

```python
# ✅ CORRECT — validate before accept
from fastapi import Query, status, WebSocketException

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)) -> None:
    try:
        # Validate token FIRST (before accept)
        payload = jwt.decode(token, "secret", algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("No user_id in token")
    except (jwt.InvalidTokenError, ValueError) as e:
        # Reject BEFORE accepting connection
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Unauthorized"
        )
        return
    
    # Only accept after successful validation
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"User {user_id}: {data}")
    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected")

# Timeline:
# T=0: Attacker sends request with invalid token
# T=1: Server validates token, finds it invalid
# T=2: Server rejects (never accepts)
# → Connection NEVER opens
```

