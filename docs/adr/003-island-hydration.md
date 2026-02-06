# ADR-003: Island Hydration Over Global Hydration

**Status:** Accepted

## Context

Server-side rendered HTML needs to become interactive in the browser. The standard approach in single-framework apps is **global hydration**: one framework instance takes ownership of the entire `<body>`, reconciles the server HTML with its virtual DOM, and attaches event handlers everywhere.

This doesn't work when the page is composed of fragments from different frameworks (React and Vue in our case). Even within a single framework, global hydration creates a coupling point: every fragment must be compatible with the same framework version and render in the same tree.

IKEA avoids global hydration. Each page section hydrates only its own DOM island. There is no single React or Vue instance that owns the full page.

## Decision

Each MFE hydrates **only its own DOM node**, identified by a unique element ID:

| MFE | Framework | Container ID | Hydration API |
|-----|-----------|-------------|---------------|
| mfe-header | React 18 | `#mfe-header` | `hydrateRoot()` |
| mfe-todo-list | Vue 3 | `#mfe-todo-list` | `createSSRApp().mount()` |
| mfe-create-todo | Vue 3 | `#mfe-create-todo` | `createSSRApp().mount()` |

Each MFE's client bundle is loaded via its own `<script>` tag (included in the fragment response). When the script runs, it:

1. Finds its container element by ID.
2. Reads serialized state from a `<script type="application/json">` sibling (if applicable).
3. Hydrates the server-rendered HTML within that container.

See [mfe-header/src/client.tsx](mfe-header/src/client.tsx) (React) and [mfe-todo-list/src/client.ts](mfe-todo-list/src/client.ts) (Vue) for the two patterns.

The key constraint: **no MFE touches DOM outside its own container.** Communication happens via events (see ADR-004), never via DOM manipulation of another MFE's tree.

## Consequences

**Benefits:**

- **Framework coexistence.** React and Vue hydrate on the same page without conflict. Each framework only knows about its own subtree.
- **Independent failure.** If one MFE's hydration fails (e.g., a JS error), the others still hydrate and become interactive. The failed MFE's SSR HTML remains visible, just static.
- **Independent upgrades.** One team can upgrade from React 18 to React 19 (or Vue 3 to Vue 4) without affecting other MFEs. The hydration boundary isolates version differences.
- **Smaller hydration scope.** Each framework only reconciles a small DOM subtree, not the entire page. This is faster than full-page hydration.

**Trade-offs:**

- **No shared component tree.** You cannot use React Context or Vue provide/inject to pass data across MFE boundaries. Cross-MFE communication must use a different mechanism (ADR-004).
- **Multiple framework runtimes in the browser.** The page loads both React and Vue. For this POC that's acceptable; at scale, teams typically converge on one or two frameworks to limit bundle overhead.
- **Hydration mismatch risk per island.** Each MFE must ensure its client render matches its server render. The serialized JSON state bridge (`mfe-header-data`, `mfe-todo-list-data`) exists specifically to pass the same data to both SSR and hydration.
