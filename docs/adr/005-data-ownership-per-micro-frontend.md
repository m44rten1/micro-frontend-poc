# ADR-005: Data Ownership via a Dedicated API Service

**Status:** Accepted (updated — supersedes original that placed data ownership inside `mfe-todo-list`)

## Context

The todo data (list of items, their done/not-done state) needs to live somewhere. Options:

1. **Shared database/BFF** -- A central backend-for-frontend service owns the data. All MFEs call it.
2. **Client-only state** -- Data lives in the browser (localStorage, in-memory). SSR renders empty shells.
3. **Data ownership by one MFE** -- One MFE owns the data domain, stores it, and exposes an API. Other MFEs consume that API.
4. **Dedicated API service** -- A standalone service owns the data domain and exposes a REST API. MFEs are pure UI; they fetch data from the API at SSR time and from the browser at runtime.

IKEA treats frontend services like backend microservices: each service owns its data and exposes a contract. There is no single shared database that all MFEs connect to directly.

## Decision

**A dedicated `api-todo` service owns the todo data domain.** It has:

- An **in-memory store** ([api-todo/src/store.ts](api-todo/src/store.ts)) with CRUD operations.
- A **REST API** on its own Express server (port 3004):
  - `GET /api/todos` -- returns all todos + counts (consumed by `mfe-header` and `mfe-todo-list` at SSR time).
  - `POST /api/todos` -- creates a new todo (consumed by `mfe-create-todo` from the browser).
  - `PATCH /api/todos/:id/toggle` -- toggles done state (consumed by `mfe-todo-list` from the browser).

This separates data ownership from UI rendering. The MFEs are pure view services that produce HTML fragments; the API service is a pure data service.

Other MFEs interact with the data through this API:

- **`mfe-header`** calls `GET /api/todos` during SSR ([mfe-header/src/render.tsx](mfe-header/src/render.tsx)) to get the real open/total counts for server rendering.
- **`mfe-create-todo`** calls `POST /api/todos` from the browser ([mfe-create-todo/src/CreateTodo.vue](mfe-create-todo/src/CreateTodo.vue)) when the user submits the form.
- **`mfe-todo-list`** calls `GET /api/todos` at SSR time ([mfe-todo-list/src/render.ts](mfe-todo-list/src/render.ts)) and `PATCH /api/todos/:id/toggle` from the browser for optimistic updates with server confirmation.

This means a full page reload always shows the current state of the data -- because MFEs SSR-render from the API, and the API is the single source of truth.

## Consequences

**Benefits:**

- **Real SSR.** Because the data is server-side, SSR produces meaningful HTML with actual content. The browser gets a fully rendered todo list on first load, not a loading spinner.
- **Single source of truth.** There is exactly one place where todos are created, stored, and mutated. No state synchronization bugs between multiple stores.
- **Clear separation of concerns.** MFEs are pure UI services. The API service is a pure data service. Neither has mixed responsibilities.
- **Clear API contract.** The REST API is a versioned, testable boundary. MFEs depend on the API shape, not on internal implementation details of the store.
- **Mirrors microservice patterns.** This is the same bounded-context ownership that works in backend architectures. Teams familiar with backend microservices will recognize the pattern.

**Trade-offs:**

- **Cross-origin requests from the browser.** Since the page is served from `:3000` (shell) but the API is on `:3004` (api-todo), browser requests are cross-origin. We handle this with CORS headers. In production, an API gateway or reverse proxy at the edge would eliminate this.
- **MFE-to-API SSR dependency.** `mfe-header` and `mfe-todo-list` depend on `api-todo` being available at SSR time. If the API is down, the header SSR-renders with count 0 and the todo list renders empty. This is an acceptable degradation, but it is a runtime dependency.
- **In-memory store is ephemeral.** For this POC, restarting `api-todo` resets the data. In production, this would be backed by a persistent store (database, cache) owned by the same team.
- **Extra service to operate.** Extracting the API into its own service adds one more process to start and monitor. The benefit appears when data logic grows independently of UI logic, or when multiple MFEs need the same data.
