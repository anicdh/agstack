# Go Async Gotchas

## 1. Goroutine Leak from Bare go func()

**Symptom:** Goroutines pile up over time; memory usage grows; connections exhausted.

**Cause:** Using bare `go func()` without coordination or using goroutines that never exit.

```go
// ❌ WRONG — orphan goroutine that never exits
func (c *Container) FetchUsers(ctx context.Context) {
    go func() {
        result, _ := c.externalAPI.Get(context.Background())  // Ignores context, never exits!
        c.Logger.Info("fetched", "result", result)
    }()
    return  // Function returns but goroutine runs forever
}

// ✅ CORRECT — errgroup waits for all goroutines
func (c *Container) FetchUsers(ctx context.Context) error {
    g, ctx := errgroup.WithContext(ctx)
    g.Go(func() error {
        result, err := c.externalAPI.Get(ctx)  // Respects context
        if err != nil {
            return fmt.Errorf("fetch: %w", err)
        }
        c.Logger.Info("fetched", "result", result)
        return nil
    })
    return g.Wait()  // Waits for goroutine to finish
}
```

## 2. Closure Variable Capture

**Symptom:** Loop variable value wrong in goroutine; all goroutines use last value.

**Cause:** Capturing loop variable directly instead of local copy.

```go
// ❌ WRONG — closure captures loop variable by reference
func (c *Container) ProcessItems(ctx context.Context, items []string) error {
    g, ctx := errgroup.WithContext(ctx)
    for _, item := range items {
        g.Go(func() error {
            return c.process(ctx, item)  // All goroutines use last item value!
        })
    }
    return g.Wait()
}

// ✅ CORRECT — local copy in closure
func (c *Container) ProcessItems(ctx context.Context, items []string) error {
    g, ctx := errgroup.WithContext(ctx)
    for _, item := range items {
        item := item  // Create local copy
        g.Go(func() error {
            return c.process(ctx, item)  // Each goroutine gets its own copy
        })
    }
    return g.Wait()
}
```

## 3. Ignoring Context Cancellation in Loop

**Symptom:** Loop continues after context cancelled; client disconnects but server keeps processing.

**Cause:** Not checking `ctx.Done()` in tight loops.

```go
// ❌ WRONG — processes all items even if context cancelled
func (c *Container) ProcessStream(ctx context.Context, items []string) error {
    for _, item := range items {
        c.process(ctx, item)  // Doesn't check if context cancelled
    }
    return nil
}

// ✅ CORRECT — checks for cancellation
func (c *Container) ProcessStream(ctx context.Context, items []string) error {
    for _, item := range items {
        select {
        case <-ctx.Done():
            return ctx.Err()  // Stop if context cancelled
        default:
        }
        c.process(ctx, item)
    }
    return nil
}
```

## 4. Context Timeout Too Tight

**Symptom:** Operations timeout inconsistently; operations that should succeed fail randomly.

**Cause:** Context timeout set shorter than operation duration.

```go
// ❌ WRONG — timeout too tight for batch operation
func (c *Container) BatchProcess(ctx context.Context, items []string) error {
    ctx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)  // Too short!
    defer cancel()
    
    for _, item := range items {
        c.process(ctx, item)  // Each operation needs ~100ms, timeout fires
    }
    return nil
}

// ✅ CORRECT — timeout scaled for operation
func (c *Container) BatchProcess(ctx context.Context, items []string) error {
    // 100ms per item + 500ms overhead
    timeout := time.Duration(len(items)*100+500) * time.Millisecond
    ctx, cancel := context.WithTimeout(ctx, timeout)
    defer cancel()
    
    for _, item := range items {
        c.process(ctx, item)
    }
    return nil
}
```

## 5. Deadlock with Channel

**Symptom:** Program hangs; all goroutines waiting on channel.

**Cause:** Channel send with no receiver, or receiver blocked waiting for value.

```go
// ❌ WRONG — deadlock: sending to channel with no goroutines receiving
func (c *Container) ProcessWithChannel(ctx context.Context, items []string) error {
    resultChan := make(chan string)
    for _, item := range items {
        go func(i string) {
            resultChan <- c.process(i)  // No one reading from channel!
        }(item)
    }
    // Hangs here — all goroutines block on channel send
    return nil
}

// ✅ CORRECT — separate goroutine consumes results
func (c *Container) ProcessWithChannel(ctx context.Context, items []string) error {
    resultChan := make(chan string, len(items))  // Buffered channel
    g, ctx := errgroup.WithContext(ctx)
    
    // Producers
    for _, item := range items {
        item := item
        g.Go(func() error {
            result, err := c.process(ctx, item)
            if err != nil {
                return err
            }
            resultChan <- result
            return nil
        })
    }
    
    // Consumer in separate goroutine
    g.Go(func() error {
        g.Wait()      // Wait for producers
        close(resultChan)
        return nil
    })
    
    for range resultChan {  // Drain channel
        // Handle result
    }
    return g.Wait()
}
```

## 6. Race Condition with Shared State

**Symptom:** Intermittent failures; data corruption; crashes in production but not in dev.

**Cause:** Multiple goroutines accessing same variable without synchronization.

```go
// ❌ WRONG — race condition on counter
type Handler struct {
    count int  // Shared state
}

func (h *Handler) Increment() {
    h.count++  // Multiple goroutines read, increment, write
}

// Run concurrent: go h.Increment() + go h.Increment()
// Result: count = 1 instead of 2 (lost update)

// ✅ CORRECT — use sync.Mutex or atomic
type Handler struct {
    mu    sync.Mutex
    count int
}

func (h *Handler) Increment() {
    h.mu.Lock()
    defer h.mu.Unlock()
    h.count++  // Only one goroutine at a time
}
```
