# ADR-005: Data Ownership Per Micro-Frontend

**Status:** Accepted

## Context

The todo data (list of items, their done/not-done state) needs to live somewhere. Options:

1. **Shared database/BFF** -- A central backend-for-frontend service owns the data. All MFEs call it.
2. **Client-only state** -- Data lives in the browser (localStorage, in-memory). SSR renders empty shells.
3. **Data ownership by one MFE** -- One MFE owns the data domain, stores it, and exposes an API. Other MFEs consume that API.

IKEA treats frontend services like backend microservices: each service owns its data and exposes a contract. There is no single shared database that all MFEs connect to directly.

## Decision

**`mfe-todo-list` owns the todo data domain.** It has:

- An **in-memory store** ([mfe-todo-list/src/store.ts](mfe-todo-list/src/store.ts)) with CRUD operations.
- A **REST API** exposed on the same Express server:
  - `GET /api/todos` -- returns all todos + counts (consumed by `mfe-header` at SSR time, and by any MFE at runtime).
  - `POST /api/todos` -- creates a new todo (consumed by `mfe-create-todo`).
  - `PATCH /api/todos/:id/toggle` -- toggles done state (consumed by `mfe-todo-list` itself from the browser).

Other MFEs interact with the data through this API:

- **`mfe-header`** calls `GET /api/todos` during SSR ([mfe-header/src/server.ts](mfe-header/src/server.ts) lines 20-28) to get the real open/total counts for server rendering.
- **`mfe-create-todo`** calls `POST /api/todos` from the browser ([mfe-create-todo/src/CreateTodo.ts](mfe-create-todo/src/CreateTodo.ts) lines 17-22) when the user submits the form.
- **`mfe-todo-list`** calls `PATCH /api/todos/:id/toggle` from the browser for optimistic updates with server confirmation.

This means a full page reload always shows the current state of the data -- because `mfe-todo-list` SSR-renders from the store, and `mfe-header` fetches the latest counts from the API.

## Consequences

**Benefits:**

- **Real SSR.** Because the data is server-side, SSR produces meaningful HTML with actual content. The browser gets a fully rendered todo list on first load, not a loading spinner.
- **Single source of truth.** There is exactly one place where todos are created, stored, and mutated. No state synchronization bugs between multiple stores.
- **Clear API contract.** The REST API is a versioned, testable boundary. Other MFEs depend on the API shape, not on internal implementation details of the store.
- **Mirrors microservice patterns.** This is the same bounded-context ownership that works in backend architectures. Teams familiar with backend microservices will recognize the pattern.

**Trade-offs:**

- **Cross-origin requests from the browser.** Since the page is served from `:3000` (shell) but the API is on `:3002` (mfe-todo-list), browser requests are cross-origin. We handle this with CORS headers. In production, an API gateway or reverse proxy at the edge would eliminate this.
- **MFE-to-MFE SSR dependency.** `mfe-header` depends on `mfe-todo-list` being available at SSR time to get the count. If `mfe-todo-list` is down, the header SSR-renders with count 0. This is an acceptable degradation, but it is a runtime dependency between services.
- **In-memory store is ephemeral.** For this POC, restarting `mfe-todo-list` resets the data. In production, this would be backed by a persistent store (database, cache) owned by the same team.
