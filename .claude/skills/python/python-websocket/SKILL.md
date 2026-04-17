---
name: python-websocket
description: >
  WebSocket patterns for FastAPI backends. Covers connection management, room-based broadcasting,
  Pydantic message validation, JWT auth on upgrade, heartbeats, and testing.
  Triggered when implementing real-time features, chat, notifications, or live data feeds.
invocation: auto
---

# FastAPI WebSocket Patterns

> **Before implementing WebSocket endpoints**, read this skill + `python-dev`, `python-fastapi`, `python-async`.
> Read `gotchas.md` to avoid connection manager crashes and memory leaks.

## FastAPI WebSocket Endpoint

```python
# ✅ CORRECT — basic WebSocket endpoint
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import logging

app = FastAPI()
logger = logging.getLogger(__name__)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Basic WebSocket connection handler."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received: {data}")
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1011)

# ❌ WRONG — missing disconnect handler
@app.websocket("/ws")
async def websocket_endpoint_bad(websocket: WebSocket) -> None:
    await websocket.accept()
    while True:  # If client closes, crashes with uncaught exception
        data = await websocket.receive_text()
        await websocket.send_text(data)
```

**Rules:**
- ALWAYS wrap receive/send in try-except WebSocketDisconnect
- Use `.accept()` before any send/receive
- NEVER await receive/send without catching WebSocketDisconnect

---

## Connection Manager (Room/Channel Pattern)

```python
# ✅ CORRECT — connection manager with cleanup
from __future__ import annotations

from typing import Callable
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manage WebSocket connections and broadcasting to rooms."""
    
    def __init__(self) -> None:
        # rooms[room_id] = [connection1, connection2, ...]
        self.active_connections: dict[str, list[WebSocket]] = {}
    
    async def connect(self, room_id: str, websocket: WebSocket) -> None:
        """Accept and track connection in a room."""
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        logger.info(f"Client connected to room {room_id} (total: {len(self.active_connections[room_id])})")
    
    def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        """Remove disconnected client from room."""
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            logger.info(f"Client disconnected from room {room_id} (remaining: {len(self.active_connections[room_id])})")
            # Clean up empty rooms
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
    
    async def broadcast(self, room_id: str, message: str) -> None:
        """Send message to all clients in a room."""
        if room_id not in self.active_connections:
            return
        
        # Collect dead connections to remove
        dead_connections: list[WebSocket] = []
        for connection in self.active_connections[room_id]:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Failed to send to connection: {e}")
                dead_connections.append(connection)
        
        # Remove dead connections
        for connection in dead_connections:
            self.disconnect(room_id, connection)

# ✅ CORRECT — usage in endpoint
manager = ConnectionManager()

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str) -> None:
    """Join a room and receive broadcasts."""
    await manager.connect(room_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(room_id, f"Room {room_id}: {data}")
    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(room_id, websocket)

# ❌ WRONG — no cleanup of dead connections, memory leak
class BadConnectionManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []
    
    async def broadcast(self, message: str) -> None:
        for conn in self.connections:
            await conn.send_text(message)
            # If client disconnected, exception silently ignored
            # Dead connection stays in list forever → memory leak
```

---

## Pydantic Message Protocol

```python
# ✅ CORRECT — Pydantic models for validation
from pydantic import BaseModel, Field, validator

class IncomingMessage(BaseModel):
    """Message from client."""
    type: str = Field(..., min_length=1, max_length=50)
    payload: dict | None = None
    
    @validator("type")
    def type_valid(cls, v: str) -> str:
        allowed = {"chat", "ping", "subscribe"}
        if v not in allowed:
            raise ValueError(f"type must be one of {allowed}")
        return v

class OutgoingMessage(BaseModel):
    """Message to client."""
    type: str
    payload: dict | None = None
    timestamp: float

# ✅ CORRECT — parse incoming JSON with validation
import json
from fastapi import WebSocketException

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = IncomingMessage.model_validate_json(data)
                logger.info(f"Received valid message: type={msg.type}")
                
                # Respond with OutgoingMessage
                response = OutgoingMessage(
                    type="ack",
                    payload={"received": msg.type},
                    timestamp=time.time()
                )
                await websocket.send_text(response.model_dump_json())
            except json.JSONDecodeError:
                await websocket.send_text(
                    OutgoingMessage(
                        type="error",
                        payload={"error": "Invalid JSON"},
                        timestamp=time.time()
                    ).model_dump_json()
                )
            except ValueError as e:
                await websocket.send_text(
                    OutgoingMessage(
                        type="error",
                        payload={"error": str(e)},
                        timestamp=time.time()
                    ).model_dump_json()
                )
    except WebSocketDisconnect:
        logger.info("Client disconnected")

# ❌ WRONG — no validation, string parsing
@app.websocket("/ws")
async def websocket_endpoint_bad(websocket: WebSocket) -> None:
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        # Raw string, no schema validation
        message_type = data.split(":")[0]  # Fragile parsing
        await websocket.send_text(message_type)
```

---

## JWT Authentication on Upgrade

```python
# ✅ CORRECT — validate JWT token before accept
from fastapi import Query, status
import jwt

async def get_token_from_query(token: str = Query(...)) -> dict:
    """Extract and validate token from query param."""
    try:
        payload = jwt.decode(token, "your-secret", algorithms=["HS256"])
        return payload
    except jwt.InvalidTokenError:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
) -> None:
    """WebSocket endpoint with token auth."""
    try:
        # Validate token BEFORE accept
        payload = await get_token_from_query(token)
        user_id = payload.get("sub")
        logger.info(f"Authenticated user {user_id}")
    except WebSocketException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        return
    
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"User {user_id}: {data}")
            await websocket.send_text(f"User {user_id} received: {data}")
    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected")

# ❌ WRONG — accept first, then validate (connection already open)
@app.websocket("/ws")
async def websocket_endpoint_bad(websocket: WebSocket, token: str = Query(...)) -> None:
    await websocket.accept()  # Too early!
    try:
        payload = jwt.decode(token, "secret", algorithms=["HS256"])
    except jwt.InvalidTokenError:
        await websocket.close()  # Connection already open, waste of resources
```

---

## Heartbeat/Ping-Pong Pattern

```python
# ✅ CORRECT — send periodic heartbeat to detect dead connections
import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def heartbeat_task(websocket: WebSocket, interval: float = 30.0):
    """Background task that sends periodic heartbeat."""
    async def ping_loop() -> None:
        try:
            while True:
                await asyncio.sleep(interval)
                await websocket.send_json({"type": "ping"})
        except Exception as e:
            logger.warning(f"Heartbeat failed: {e}")
    
    task = asyncio.create_task(ping_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    async with heartbeat_task(websocket):
        try:
            while True:
                data = await websocket.receive_text()
                if data == "pong":
                    logger.debug("Pong received")
                else:
                    await websocket.send_text(f"Echo: {data}")
        except WebSocketDisconnect:
            logger.info("Client disconnected")

# ❌ WRONG — no heartbeat, dead connections linger
@app.websocket("/ws")
async def websocket_endpoint_bad(websocket: WebSocket) -> None:
    await websocket.accept()
    while True:
        data = await websocket.receive_text()  # Blocks forever if client crashes
        await websocket.send_text(data)
```

---

## Graceful Disconnect Handling

```python
# ✅ CORRECT — cleanup on disconnect
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str) -> None:
    await manager.connect(room_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(room_id, data)
    except WebSocketDisconnect:
        # Client closed connection
        manager.disconnect(room_id, websocket)
        await manager.broadcast(room_id, f"User left room {room_id}")
        logger.info(f"Client gracefully disconnected from {room_id}")
    except Exception as e:
        # Unexpected error, still clean up
        logger.error(f"Unexpected WebSocket error: {e}")
        manager.disconnect(room_id, websocket)

# ❌ WRONG — no cleanup on exception
@app.websocket("/ws/{room_id}")
async def websocket_endpoint_bad(websocket: WebSocket, room_id: str) -> None:
    await manager.connect(room_id, websocket)
    while True:
        data = await websocket.receive_text()
        # If exception here, manager.disconnect never called
        # Connection stays in memory → memory leak
        await manager.broadcast(room_id, data)
```

---

## Background Tasks with WebSocket

```python
# ✅ CORRECT — background task + WebSocket communication
async def notify_room(room_id: str, message: str) -> None:
    """Background task: notify room of updates."""
    await manager.broadcast(room_id, f"Notification: {message}")

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str) -> None:
    await manager.connect(room_id, websocket)
    
    # Start background task
    bg_task = asyncio.create_task(notify_room(room_id, "Hello room"))
    
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(room_id, data)
    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
    finally:
        bg_task.cancel()
        try:
            await bg_task
        except asyncio.CancelledError:
            pass

# ❌ WRONG — blocking operation in handler
@app.websocket("/ws")
async def websocket_endpoint_bad(websocket: WebSocket) -> None:
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        # BLOCKS event loop for 5 seconds — no other WebSocket works!
        time.sleep(5)
        await websocket.send_text(data)
```

---

## Error Handling & Reconnection

```python
# ✅ CORRECT — handle various error states
from fastapi import WebSocketException

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    try:
        await websocket.accept()
    except RuntimeError as e:
        logger.error(f"Failed to accept WebSocket: {e}")
        return
    
    try:
        while True:
            try:
                data = await websocket.receive_text()
                await websocket.send_text(f"Echo: {data}")
            except WebSocketDisconnect:
                logger.info("Normal disconnect")
                break
            except ConnectionResetError:
                logger.warning("Connection reset by peer")
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                try:
                    await websocket.send_json({"error": str(e)})
                except Exception:
                    pass  # Connection already broken
                break
    finally:
        try:
            await websocket.close()
        except Exception:
            pass  # Already closed

# ❌ WRONG — catch-all with no specific handling
@app.websocket("/ws")
async def websocket_endpoint_bad(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(data)
    except:  # Bare except catches everything including KeyboardInterrupt
        pass
```

---

## Testing WebSocket Endpoints

```python
# ✅ CORRECT — test with TestClient
from fastapi.testclient import TestClient
import pytest

@pytest.mark.anyio
async def test_websocket_connection():
    """Test WebSocket connection and message echo."""
    client = TestClient(app)
    
    with client.websocket_connect("/ws") as websocket:
        # Send message
        websocket.send_text("Hello")
        # Receive echo
        data = websocket.receive_text()
        assert data == "Echo: Hello"

@pytest.mark.anyio
async def test_websocket_disconnect():
    """Test graceful disconnect."""
    client = TestClient(app)
    
    with client.websocket_connect("/ws") as websocket:
        websocket.send_text("test")
        data = websocket.receive_text()
        assert data is not None
    # Context manager exit closes connection automatically

@pytest.mark.anyio
async def test_websocket_with_params():
    """Test WebSocket with query parameters (e.g., room_id)."""
    client = TestClient(app)
    
    with client.websocket_connect("/ws/room123") as websocket:
        websocket.send_text("Message")
        data = websocket.receive_text()
        assert "room123" in data or data == "Message"

# ❌ WRONG — not using TestClient context manager
@pytest.mark.anyio
async def test_websocket_bad():
    client = TestClient(app)
    websocket = client.websocket_connect("/ws")  # Never closed
    # Resource leak
```

---

## Anti-Patterns — NEVER Do These

| Anti-pattern | Why it's wrong | Fix |
|---|---|---|
| No WebSocketDisconnect handler | Server crashes on client close | Wrap in try-except WebSocketDisconnect |
| Blocking I/O in handler (time.sleep, requests) | Blocks event loop for all WebSockets | Use async version (await asyncio.sleep, httpx) |
| No cleanup in finally block | Memory leak of stale connections | Use try/finally, context managers |
| Broadcasting to all connections without checking status | Silent failures pile up | Track dead connections, remove them |
| Accept before auth validation | Unauthenticated connection established | Validate token BEFORE accept |
| No heartbeat mechanism | Dead connections linger indefinitely | Send periodic ping, close on timeout |
| Synchronous DB queries | Blocks event loop | Use async SQLAlchemy queries |
| Shared mutable state without locks | Race conditions in multi-client scenarios | Use asyncio.Lock if needed |
| Accepting without reject path | No way to deny connection | Check auth/params before accept |
| Raw dict/string messages | No schema validation, fragile | Use Pydantic models for all messages |

---

## Before Commit Checklist

- [ ] All `await websocket.receive_*()` calls wrapped in try-except WebSocketDisconnect?
- [ ] Connection manager cleans up dead connections?
- [ ] No blocking I/O (sync requests, time.sleep) in WebSocket handler?
- [ ] Authentication validates token BEFORE `accept()`?
- [ ] All messages validated with Pydantic models?
- [ ] Background tasks cancelled in finally block?
- [ ] Heartbeat implemented for long-lived connections?
- [ ] Tests cover normal disconnect + error cases?
- [ ] Logging includes user/room context?
- [ ] No `print()` statements — use logger?

