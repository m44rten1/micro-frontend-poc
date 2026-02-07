# ADR-002: SSR HTML Fragments as the Integration Boundary

**Status:** Accepted

## Context

Once we chose server-side composition (ADR-001), we needed to define what each MFE exposes to the shell. Options include:

1. **JavaScript modules** (e.g., Module Federation) -- The shell imports a JS entry point, calls a render function, and handles the output.
2. **JSON data** -- Each MFE returns structured data; the shell renders all UI.
3. **HTML fragments** -- Each MFE returns a self-contained chunk of rendered HTML, optionally including `<script>` tags for client hydration.

IKEA chose option 3. Each page section (header, product content, recommendations, footer) is a service that returns an HTML fragment via a simple HTTP endpoint. The CDN/edge layer composes these fragments using ESI includes.

## Decision

Each MFE exposes a `render()` function (in its server bundle) that returns **rendered HTML + hydration state**. The shell composes the full fragment by combining:

1. A wrapping `<div>` with a unique ID (e.g., `<div id="mfe-header">...</div>`).
2. Server-rendered HTML inside that div — produced by the framework's SSR renderer (`renderToString` for React, `renderToString` from `vue/server-renderer` for Vue).
3. An optional `<script type="application/json">` block embedding serialized state for hydration.
4. A `<script src="...">` tag pointing to the MFE's client bundle on the registry.

> **Note:** Originally each MFE exposed a `GET /fragment` HTTP endpoint from its own server. As of ADR-007, MFEs are published as self-contained bundles and the shell calls their `render()` functions in-process.

Example output from [mfe-header/src/render.tsx](mfe-header/src/render.tsx):

```html
<div id="mfe-header"><!-- SSR'd React HTML --></div>
<script type="application/json" id="mfe-header-data">{"openCount":2,"totalCount":3}</script>
<script src="http://localhost:3005/packages/header/1.0.0/client.js"></script>
```

The shell injects these fragments into the page template verbatim. It never parses or transforms the fragment content.

## Consequences

**Benefits:**

- **Framework freedom.** The shell sees HTML, not React components or Vue apps. This is why `mfe-header` can use React while `mfe-todo-list` and `mfe-create-todo` use Vue without any adapter layer.
- **Cacheability.** HTML fragments are plain strings -- trivially cacheable at the edge. A CDN can serve a cached header fragment for thousands of requests without hitting the service.
- **No runtime coupling.** The shell does not import framework code, does not need to know framework versions, and does not need to coordinate dependency versions across MFEs. Each MFE bundles its own framework.
- **Graceful degradation.** If JavaScript fails to load, the SSR'd HTML is still visible and readable.

**Trade-offs:**

- **Duplicated framework code.** React is bundled in the header's client.js, Vue is bundled in both Vue MFEs' client.js. In production, this would be mitigated with import maps or a shared CDN for common frameworks.
- **Hydration state must be serialized.** Each MFE embeds its SSR state as JSON so the client can pick it up. This is extra bytes on the wire and requires careful serialization (no circular references, no functions).
- **Fragment contract is implicit.** The shell expects an HTML string with a specific wrapper ID. There's no schema validation -- a malformed fragment could break the page layout. In production, contract testing between shell and MFEs would address this.
