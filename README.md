# Micro-Frontend POC

A proof of concept demonstrating **server-side fragment composition** with **island hydration** — a micro-frontend architecture where independently built MFEs are published to a registry, fetched via a manifest, and server-side rendered by the shell at request time.

## Architecture Overview

```
Build time:

  mfe-header ──► build client.js + server.cjs ──► publish ──┐
  mfe-todo-list ──► build client.js + server.cjs ──► publish ──┤──► Registry (:3005)
  mfe-create-todo ──► build client.js + server.cjs ──► publish ──┘     │
                                                                       │
Request time:                                                          │
                                                                       │
  Browser ──► Shell (:3000)                                            │
               │                                                       │
               ├── GET /manifest ──────────────────────────────────────┘
               ├── fetch server.cjs (once, then cached) ───────────────┘
               ├── call render() for SSR (via vm.compileFunction)
               ├── compose HTML with <script> tags → Registry
               │
               ▼
            Browser loads client.js from Registry, hydrates islands
                              │
                              ▼
                       api-todo (:3004)
```

## Key Concepts

### 1. Registry + Manifest

MFEs are **published artifacts**, not running servers. Each MFE builds two bundles:

- **`client.js`** — IIFE bundle for browser hydration
- **`server.cjs`** — Self-contained CJS bundle exporting a `render()` function for SSR

Both are published to a **registry** (a simple file server simulating a CDN). The registry auto-generates a **manifest** describing all available MFEs:

```json
{
  "header": {
    "version": "1.0.0",
    "entry": "http://localhost:3005/packages/header/1.0.0/client.js",
    "server": "http://localhost:3005/packages/header/1.0.0/server.cjs"
  },
  "todoList": {
    "version": "1.0.0",
    "entry": "http://localhost:3005/packages/todo-list/1.0.0/client.js",
    "server": "http://localhost:3005/packages/todo-list/1.0.0/server.cjs"
  },
  "createTodo": {
    "version": "1.0.0",
    "entry": "http://localhost:3005/packages/create-todo/1.0.0/client.js",
    "server": "http://localhost:3005/packages/create-todo/1.0.0/server.cjs"
  }
}
```

### 2. Server-Side Rendering from Published Bundles

The shell fetches the manifest on startup, downloads each MFE's server bundle, and loads it in-process using `vm.compileFunction`. On each request, the shell calls the cached `render()` functions to produce SSR HTML. The shell polls the manifest every 10 seconds so newly published versions are picked up without restart.

Server bundles are **self-contained** — all framework dependencies (React, Vue, their SSR renderers) are bundled in. The shell needs zero framework knowledge.

### 3. Island Hydration

Each micro-frontend hydrates only its own DOM subtree — an "island" of interactivity within the server-rendered page. React and Vue run side by side without knowing about each other. This means:

- Frameworks can be mixed freely (this POC uses React **and** Vue on the same page)
- A bug in one island doesn't break the others
- Each team can upgrade frameworks independently

### 4. Event-Based Communication

Micro-frontends communicate through browser `CustomEvent`s on `window`, with typed payloads defined in a shared contract package:

| Event          | Producer        | Consumers     | Purpose              |
| -------------- | --------------- | ------------- | -------------------- |
| `todo:created` | mfe-create-todo | mfe-todo-list | A new todo was added |
| `todo:changed` | mfe-todo-list   | mfe-header    | Todo counts changed  |

This keeps MFEs decoupled — they share event names and payload shapes, not code.

### 5. Data Ownership

`api-todo` owns the todo domain and is the single source of truth.
MFEs interact with todos through the API; browser events are used only to coordinate UI updates (e.g. refetch / invalidate caches / update counts).

### 6. Shared Contracts, Not Shared Code

The `@mfe/shared` workspace package contains only:

- **TypeScript types** — `Todo`, event payloads
- **Event name constants** — `TODO_CREATED`, `TODO_CHANGED`
- **CSS custom properties** — shared visual identity

No runtime logic. The shared package is a compile-time contract that disappears after build.

## Project Structure

```
├── shell/               # Edge composer — SSR via manifest + registry (Express, port 3000)
├── registry/            # MFE package registry — stores and serves published bundles (Express, port 3005)
├── mfe-header/          # Header with todo counts (React 18)
├── mfe-todo-list/       # Todo list (Vue 3)
├── mfe-create-todo/     # Create form (Vue 3)
├── api-todo/            # REST API (Express, port 3004)
├── shared/              # Shared types, events, CSS (@mfe/shared)
└── docs/adr/            # Architecture Decision Records
```

## Running It

```bash
pnpm install

# 1. Build all MFEs and publish to registry
pnpm run setup

# 2. Start registry + api + shell
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Or do both in one step:

```bash
pnpm start
```

### Publishing a change while running

1. Make your change in the MFE
2. Bump the version in its `package.json`
3. Build and publish: `pnpm --filter mfe-header run build && pnpm --filter mfe-header run publish:mfe`
4. Within 10 seconds the shell detects the version change and reloads that server bundle

## Design Decisions

Detailed rationale is captured in [Architecture Decision Records](./docs/adr/):

1. [Server-Side Fragment Composition](./docs/adr/001-server-side-fragment-composition.md)
2. [SSR HTML Fragments as Integration Boundary](./docs/adr/002-ssr-html-fragments-as-integration-boundary.md)
3. [Island Hydration](./docs/adr/003-island-hydration.md)
4. [Event-Based Communication](./docs/adr/004-event-based-communication.md)
5. [Data Ownership per Micro-Frontend](./docs/adr/005-data-ownership-per-micro-frontend.md)
6. [Shared TypeScript Types as Contract](./docs/adr/006-shared-typescript-types-as-contract.md)
7. [MFE Registry with Manifest-Driven SSR](./docs/adr/007-mfe-registry-with-manifest.md)

## What This POC Deliberately Leaves Out

Things you'd want in production but that would obscure the core patterns here:

- **Persistent storage** — the API uses an in-memory store
- **API gateway / reverse proxy** — MFEs call each other directly (hence CORS)
- **Fragment caching / HTTP streaming** — no edge caching or chunked transfer
- **Service discovery** — ports are hardcoded
- **Contract testing** — shared types provide compile-time safety only
- **Authentication / authorization**
- **Content hashing in bundle filenames** — bundles use fixed names for simplicity
- **Registry authentication / access control** — anyone can publish
