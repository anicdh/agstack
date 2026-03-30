# ADR 003: Zustand over Redux

## Status
Accepted

## Context
Need client-side state management for the React frontend. Server state is handled by React Query — this is only for UI/client state (auth session, sidebar open/close, theme, etc.).

## Decision
Use **Zustand** for client-side state management.

## Reasons
- Minimal boilerplate — a store is just a function, no actions/reducers/slices ceremony
- No provider wrapper needed — reduces component tree nesting
- Built-in `immer` middleware for immutable updates when needed
- TypeScript inference works naturally — no extra type plumbing
- Tiny bundle size (~1KB) vs Redux Toolkit (~12KB)
- Sufficient for app-scale state (auth, UI preferences, form state)

## Trade-offs
- Less structured than Redux — no enforced action/reducer pattern
- Smaller ecosystem of middleware and devtools
- Less familiar to developers coming from Redux-heavy backgrounds

## Alternatives considered
- **Redux Toolkit**: Industry standard, excellent devtools, but too much ceremony for an app where server state is already in React Query
- **Jotai/Recoil**: Atomic state model, good for derived state, but overkill for simple client state
- **React Context**: No extra dependency, but performance issues with frequent updates
