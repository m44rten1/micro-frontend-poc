# ADR-007: MFE Registry with Manifest-Driven SSR

**Status:** Accepted (supersedes the per-MFE server approach from ADR-001 and ADR-002)

## Context

In the original architecture (ADR-001, ADR-002), each MFE ran its own Express server that handled two responsibilities:

1. **SSR rendering** — producing HTML fragments via `GET /fragment`.
2. **Static file serving** — serving the client bundle from `/static/client.js`.

This worked well for the POC but has consequences at scale:

- **N services to operate at runtime.** Every MFE is a long-running process that must be deployed, monitored, scaled, and kept alive. Adding an MFE means adding a service.
- **SSR logic coupled to infrastructure.** The render function is embedded inside an Express route handler. You can't test the render in isolation, reuse it in a different composition layer, or execute it without starting a server.
- **No versioned artifacts.** There is no concept of "header v1.4.2". You deploy code and start a server. Rolling back means redeploying the previous code. There's no artifact you can point to, cache, or audit.
- **The shell must know service addresses.** Fragment URLs are hardcoded (`http://localhost:3001/fragment`). In production this requires service discovery or a registry anyway.

Modern CDN-based MFE architectures (e.g., Module Federation with a "remote entry" manifest, or Podium's podlet manifest) solve this by treating MFEs as **published artifacts** rather than running services.

## Decision

We replace per-MFE servers with a **registry + manifest** architecture:

### Registry

A simple file server ([registry/src/server.ts](registry/src/server.ts)) on port 3005 that:

- Accepts published MFE bundles via `POST /publish/:name/:version` (multipart file upload).
- Serves them as static files from `GET /packages/:name/:version/:file` with CORS headers.
- Auto-generates a manifest from the published packages via `GET /manifest`.

In production, this would be a CDN (CloudFront, Fastly, etc.) with a manifest stored in S3 or a key-value store.

### MFE Build Artifacts

Each MFE now produces two self-contained bundles:

| File | Format | Purpose |
|------|--------|---------|
| `dist/client.js` | IIFE | Browser hydration — same as before |
| `dist/server.cjs` | CJS | Exports a `render(context)` function for SSR |

The server bundle includes all framework dependencies (React, Vue, their SSR renderers). This means the shell needs zero knowledge of which frameworks the MFEs use.

The render function is a **pure function**: given a context (API base URL), it returns HTML and optional serialized state:

```typescript
interface RenderResult {
  html: string;
  state?: { id: string; data: unknown };
}

export async function render(context: { apiBase: string }): Promise<RenderResult>;
```

See [mfe-header/src/render.tsx](mfe-header/src/render.tsx) (React) and [mfe-todo-list/src/render.ts](mfe-todo-list/src/render.ts) (Vue).

### Manifest

The registry generates a manifest mapping MFE names to their versioned bundles:

```json
{
  "header": {
    "version": "1.0.0",
    "entry": "http://localhost:3005/packages/header/1.0.0/client.js",
    "server": "http://localhost:3005/packages/header/1.0.0/server.cjs"
  }
}
```

### Shell

The shell ([shell/src/server.ts](shell/src/server.ts)) no longer fetches HTML fragments from MFE servers. Instead:

1. On startup, it fetches the manifest from the registry (with retry for startup ordering).
2. For each MFE, it downloads the server bundle and loads it using `vm.compileFunction` — no temp files, no `eval`.
3. On each request, it calls the cached `render()` functions and composes the HTML.
4. Client `<script>` tags point to the registry's `entry` URLs.
5. It polls the manifest every 10 seconds and reloads only the bundles whose version has changed.

### Publish Flow

Each MFE has a `publish.ts` script that POSTs its built bundles to the registry. The workflow for deploying a change:

1. Make the code change.
2. Bump the version in `package.json`.
3. `pnpm --filter mfe-header run build && pnpm --filter mfe-header run publish:mfe`
4. Within 10 seconds, the shell picks up the new version from the manifest.

## Consequences

**Benefits:**

- **MFEs are artifacts, not services.** No MFE process runs at request time. Build, publish, done. The operational surface is reduced from N+1 services to 3 (shell, registry, API).
- **Versioned and rollbackable.** Each published version is immutable in the registry. Rolling back is pointing the manifest at a previous version, not redeploying code.
- **SSR without per-MFE servers.** The shell loads server bundles in-process. SSR is preserved — the browser still receives fully rendered HTML on first load — without the overhead of separate running services.
- **Hot manifest updates.** The shell polls the manifest, so publishing a new version is picked up automatically. No shell restart, no deployment coordination.
- **Self-contained bundles.** Server bundles include all dependencies. The shell doesn't need React or Vue installed. A new MFE could use Svelte or Solid without any shell changes.
- **Testable render functions.** The `render()` function is a pure function that can be unit tested without starting a server.

**Trade-offs:**

- **Server bundles are large.** Bundling all framework code into each server.cjs produces ~1.3 MB per Vue MFE. This is acceptable for SSR (executed once per request on the server, not downloaded by the browser), but at scale you'd want to externalize shared framework packages.
- **`vm.compileFunction` runs in the shell's process.** A buggy server bundle could crash the shell. In production, you'd run server bundles in isolated workers or sandboxed VM contexts with resource limits.
- **Manifest polling has a delay.** Up to 10 seconds between publishing and the shell picking it up. For instant rollouts, a webhook or push notification from the registry would be better.
- **No code signing or integrity checks.** The shell trusts whatever the registry serves. In production, bundles should be signed and verified (subresource integrity for client bundles, checksum verification for server bundles).
- **Registry is a single point of failure.** If the registry is down, the shell can't load new bundles (though it continues serving with cached renderers). In production, the registry would be a highly available CDN.
