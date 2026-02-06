# Micro-Frontend POC

A proof of concept demonstrating **server-side fragment composition** with **island hydration** — a micro-frontend architecture where independently deployed services render HTML fragments that are stitched together on the server, then selectively hydrated on the client.

## Architecture Overview

```
Browser request
       │
       ▼
┌─────────────┐     fetch /fragment       ┌──────────────────┐
│             │ ◄──────────────────────── │  mfe-header      │ React 18
│             │                           │  :3001           │
│   Shell     │     fetch /fragment       ┌──────────────────┐
│   :3000     │ ◄──────────────────────── │  mfe-create-todo │ Vue 3
│  (Express)  │                           │  :3003           │
│             │     fetch /fragment       ┌──────────────────┐
│             │ ◄──────────────────────── │  mfe-todo-list   │ Vue 3
└──────┬──────┘                           │  :3002           │
       │                                  └──────────────────┘
       │  Composed HTML page                     │
       ▼                                         ▼
    Browser                              ┌──────────────────┐
  (hydrates islands)                     │  api-todo        │
                                         │  :3004 (REST)    │
                                         └──────────────────┘
```

## Key Concepts

### 1. Server-Side Fragment Composition

The **shell** acts as an edge composer. On each request it fetches HTML fragments from all micro-frontends in parallel, then stitches them into a single HTML page. The shell knows nothing about React or Vue — it deals in plain HTML strings.

Each MFE exposes a `GET /fragment` endpoint that returns self-contained HTML including:

- Server-rendered markup (`<div id="mfe-{name}">...</div>`)
- Serialized state for hydration (`<script type="application/json">`)
- A `<script>` tag pointing to its client bundle

If a fragment request fails or times out (2 s), the shell renders a static fallback so the page degrades gracefully.

### 2. Island Hydration

Each micro-frontend hydrates only its own DOM subtree — an "island" of interactivity within the server-rendered page. React and Vue run side by side without knowing about each other. This means:

- Frameworks can be mixed freely (this POC uses React **and** Vue on the same page)
- A bug in one island doesn't break the others
- Each team can upgrade frameworks independently

### 3. Event-Based Communication

Micro-frontends communicate through browser `CustomEvent`s on `window`, with typed payloads defined in a shared contract package:

| Event          | Producer        | Consumers     | Purpose              |
| -------------- | --------------- | ------------- | -------------------- |
| `todo:created` | mfe-create-todo | mfe-todo-list | A new todo was added |
| `todo:changed` | mfe-todo-list   | mfe-header    | Todo counts changed  |

This keeps MFEs decoupled — they share event names and payload shapes, not code.

### 4. Data Ownership

`mfe-todo-list` owns the todo domain. It holds the canonical list, exposes a REST API for other MFEs and the shell, and is the single source of truth. Other MFEs interact with todo data only through the API or events.

### 5. Shared Contracts, Not Shared Code

The `@mfe/shared` workspace package contains only:

- **TypeScript types** — `Todo`, event payloads
- **Event name constants** — `TODO_CREATED`, `TODO_CHANGED`
- **CSS custom properties** — shared visual identity

No runtime logic. The shared package is a compile-time contract that disappears after build.

## Project Structure

```
├── shell/               # Edge composer (Express, port 3000)
├── mfe-header/          # Header with todo counts (React 18, port 3001)
├── mfe-todo-list/       # Todo list, owns data (Vue 3, port 3002)
├── mfe-create-todo/     # Create form (Vue 3, port 3003)
├── api-todo/            # REST API (Express, port 3004)
├── shared/              # Shared types, events, CSS (@mfe/shared)
└── docs/adr/            # Architecture Decision Records
```

## Running It

```bash
pnpm install
pnpm dev
```

This builds the shared package, then starts all five services concurrently. Open [http://localhost:3000](http://localhost:3000).

## Design Decisions

Detailed rationale is captured in [Architecture Decision Records](./docs/adr/):

1. [Server-Side Fragment Composition](./docs/adr/001-server-side-fragment-composition.md)
2. [SSR HTML Fragments as Integration Boundary](./docs/adr/002-ssr-html-fragments-as-integration-boundary.md)
3. [Island Hydration](./docs/adr/003-island-hydration.md)
4. [Event-Based Communication](./docs/adr/004-event-based-communication.md)
5. [Data Ownership per Micro-Frontend](./docs/adr/005-data-ownership-per-micro-frontend.md)
6. [Shared TypeScript Types as Contract](./docs/adr/006-shared-typescript-types-as-contract.md)

## What This POC Deliberately Leaves Out

Things you'd want in production but that would obscure the core patterns here:

- **Persistent storage** — the API uses an in-memory store
- **API gateway / reverse proxy** — MFEs call each other directly (hence CORS)
- **Fragment caching / HTTP streaming** — no edge caching or chunked transfer
- **Service discovery** — ports are hardcoded
- **Contract testing** — shared types provide compile-time safety only
- **Authentication / authorization**
