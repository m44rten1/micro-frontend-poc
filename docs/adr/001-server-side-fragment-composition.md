# ADR-001: Server-Side Fragment Composition at the Edge

**Status:** Accepted

## Context

We need to compose a page from multiple independently deployed micro-frontends (MFEs). There are several composition strategies:

1. **Client-side composition** (e.g., Module Federation, single-spa) -- The browser downloads a shell app and lazy-loads MFE bundles at runtime. The page is assembled in the browser.
2. **Iframe-based composition** -- Each MFE renders in its own iframe. The shell arranges iframes on the page.
3. **Build-time composition** -- MFEs are assembled into a single deployable artifact at CI/CD time.
4. **Server-side fragment composition** -- A server (or CDN/edge layer) fetches pre-rendered HTML fragments from each MFE service and stitches them into a complete page before sending it to the browser.

IKEA uses option 4 at scale: an edge/CDN layer (historically Akamai ESI, now also modern edge compute) resolves fragment includes and returns fully composed HTML. The browser never sees the seams.

## Decision

We use **server-side fragment composition**. A shell service ([shell/src/server.ts](shell/src/server.ts)) acts as the edge composer.

> **Note:** The composition mechanism has evolved. Originally the shell fetched `GET /fragment` from per-MFE servers. As of ADR-007, MFEs are published to a registry as self-contained bundles, and the shell executes their `render()` functions in-process via `vm.compileFunction`. The architectural benefits below remain the same.

- The shell calls each MFE's render function in parallel (`Promise.all`).
- It stitches the returned HTML into a page template with shared CSS.
- If a render function fails, the shell uses static fallback HTML so the page degrades gracefully.
- The browser receives a single, fully composed HTML document.

```
Browser  →  Shell (:3000)  →  render("header")      via server.cjs from Registry
                            →  render("todoList")    via server.cjs from Registry
                            →  render("createTodo")  via server.cjs from Registry
                            ←  composed HTML
```

## Consequences

**Benefits:**

- **Full SSR on first load.** The browser receives meaningful HTML immediately -- no JavaScript required for first paint, real SEO support.
- **Independent deployability.** Each MFE is a standalone service. Deploying a new version of one MFE requires zero coordination with the others or the shell.
- **Resilience.** If an MFE is down, the shell serves fallback HTML. The rest of the page still works. This mirrors IKEA's "cache or swap it" philosophy.
- **Framework agnostic.** The shell composes HTML strings. It does not care whether React, Vue, or plain HTML produced the fragment.

**Trade-offs:**

- **Added latency.** The shell must fetch fragments on every request (mitigated by parallel fetching; in production, fragment caching at the edge would eliminate this).
- **No streaming.** Our current implementation waits for all fragments before responding. A production setup would use HTTP streaming or chunked transfer to send the page progressively.
- **Operational overhead.** Each MFE is a separate running service. For a small team, this is more infrastructure than a monolith. The benefit appears at scale when teams need independent release cadences.
