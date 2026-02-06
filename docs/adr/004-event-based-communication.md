# ADR-004: Event-Based Communication, No Shared State

**Status:** Accepted

## Context

The three MFEs need to coordinate:

- When `mfe-create-todo` creates a new todo, `mfe-todo-list` must show it and `mfe-header` must update the count.
- When `mfe-todo-list` toggles a todo's done state, `mfe-header` must update the count.

Possible coordination mechanisms:

1. **Shared global store** (Redux, Pinia, Zustand) -- All MFEs read from and write to a single store.
2. **Direct DOM manipulation** -- One MFE reaches into another's DOM to update it.
3. **Shared in-memory object** -- A global JavaScript object that MFEs mutate.
4. **Browser events** -- MFEs dispatch and listen for `CustomEvent` on `window`.

IKEA uses contracts over shared state. There is no giant shared Redux/Pinia store across the whole page. MFEs communicate via APIs and events, not shared memory.

## Decision

MFEs communicate via **`CustomEvent` on `window`**, with typed payloads defined in the shared contract package.

Two events exist:

| Event | Dispatched by | Listened by | Payload |
|-------|--------------|-------------|---------|
| `todo:created` | mfe-create-todo | mfe-todo-list | `TodoCreatedPayload { todo: Todo }` |
| `todo:changed` | mfe-todo-list | mfe-header | `TodoChangedPayload { totalCount, openCount }` |

Event name constants are defined in [shared/src/events.ts](shared/src/events.ts). Payload types are defined in [shared/src/types.ts](shared/src/types.ts).

The flow when a user creates a todo:

1. `mfe-create-todo` POSTs to the todo API service (`POST /api/todos` on `api-todo`).
2. On success, it dispatches `window.dispatchEvent(new CustomEvent('todo:created', { detail: { todo } }))`.
3. `mfe-todo-list` listens for `todo:created`, adds the todo to its local state, and re-renders.
4. `mfe-todo-list` dispatches `todo:changed` with the updated counts.
5. `mfe-header` (React) listens for `todo:changed` and updates its badge via `setState`.

See [mfe-todo-list/src/TodoList.vue](mfe-todo-list/src/TodoList.vue) (`emitChanged` and `handleTodoCreated` in the `<script setup>` block) for the implementation.

## Consequences

**Benefits:**

- **Zero coupling between MFEs.** No MFE imports code from another MFE. They only share event names and payload shapes.
- **Framework agnostic.** `CustomEvent` is a browser API. React, Vue, Svelte, or vanilla JS can all dispatch and listen. No framework-specific adapter needed.
- **Unidirectional and traceable.** The event flow is explicit and easy to follow: create dispatches `todo:created`, list processes it and dispatches `todo:changed`, header consumes it. No circular dependencies.
- **Failure isolation.** If `mfe-header` is down or fails to hydrate, `mfe-create-todo` and `mfe-todo-list` still work. The events are fire-and-forget.

**Trade-offs:**

- **No guaranteed delivery.** If a listener isn't registered when an event fires (e.g., hydration hasn't completed yet), the event is lost. For this POC, the `onMounted` → `emitChanged()` call in the todo-list component addresses the initial sync. In production, a replay buffer or initial-state fetch would be needed.
- **Debugging is harder.** Events are invisible in standard DevTools unless you instrument them. A production setup would add logging middleware around event dispatch.
- **Loose typing at runtime.** The TypeScript types are compile-time only. At runtime, `CustomEvent.detail` is `any`. A malformed payload from a buggy MFE version would not be caught until it causes a UI error. Contract testing between MFE versions would mitigate this.
