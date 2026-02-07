import express from 'express';
import path from 'path';
import { compileFunction } from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const app = express();
const PORT = 3000;
const REGISTRY_URL = process.env.REGISTRY_URL ?? 'http://localhost:3005';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3004';

// ── Types ──

interface ManifestEntry {
  version: string;
  entry: string;   // client bundle URL (served to browser)
  server: string;  // server bundle URL (executed by shell for SSR)
}

type Manifest = Record<string, ManifestEntry>;

interface RenderResult {
  html: string;
  state?: { id: string; data: unknown };
}

type RenderFn = (context: { apiBase: string }) => Promise<RenderResult>;

// ── Load a CJS server bundle from a URL and extract the render function ──

async function loadRenderer(name: string, url: string): Promise<RenderFn> {
  const code = await fetch(url).then((r) => r.text());
  const mod = { exports: {} as Record<string, unknown> };
  const fn = compileFunction(code, ['module', 'exports', 'require'], {
    filename: `mfe-${name}-server.cjs`,
  });
  fn(mod, mod.exports, require);
  return mod.exports.render as RenderFn;
}

// ── Fallbacks when an MFE is unavailable ──

const FALLBACKS: Record<string, string> = {
  header:
    '<div id="mfe-header"><header class="header"><div class="header__inner"><h1 class="header__title">Todo App</h1></div></header></div>',
  createTodo:
    '<div id="mfe-create-todo" class="fragment-fallback">Create form temporarily unavailable</div>',
  todoList:
    '<div id="mfe-todo-list" class="fragment-fallback">Todo list temporarily unavailable</div>',
};

// ── Cached renderers loaded from registry ──

const MANIFEST_POLL_MS = 10_000; // re-fetch manifest every 10s

let manifest: Manifest = {};
let renderers: Record<string, RenderFn> = {};

async function refreshManifest(): Promise<void> {
  const res = await fetch(`${REGISTRY_URL}/manifest`);
  if (!res.ok) throw new Error(`Failed to fetch manifest: HTTP ${res.status}`);
  const next = (await res.json()) as Manifest;

  // Determine which MFEs are new or have a different version
  const toLoad: [string, ManifestEntry][] = [];
  for (const [name, entry] of Object.entries(next)) {
    if (manifest[name]?.version !== entry.version || !renderers[name]) {
      toLoad.push([name, entry]);
    }
  }

  // Remove renderers for MFEs no longer in the manifest
  for (const name of Object.keys(renderers)) {
    if (!(name in next)) {
      console.log(`[shell] MFE "${name}" removed from manifest`);
      delete renderers[name];
    }
  }

  if (toLoad.length === 0) {
    manifest = next;
    return; // nothing changed
  }

  console.log(`[shell] Manifest changed — reloading: ${toLoad.map(([n, e]) => `${n}@${e.version}`).join(', ')}`);

  const loaded = await Promise.allSettled(
    toLoad.map(async ([name, entry]) => {
      const renderer = await loadRenderer(name, entry.server);
      return [name, renderer] as const;
    }),
  );

  for (const result of loaded) {
    if (result.status === 'fulfilled') {
      const [name, renderer] = result.value;
      renderers[name] = renderer;
      console.log(`[shell] ✓ Loaded renderer for "${name}"`);
    } else {
      console.warn(`[shell] ✗ Failed to load renderer:`, result.reason);
    }
  }

  manifest = next;
}

function startManifestPolling(): void {
  setInterval(async () => {
    try {
      await refreshManifest();
    } catch (err) {
      console.warn('[shell] Manifest poll failed:', err instanceof Error ? err.message : err);
    }
  }, MANIFEST_POLL_MS);
}

// ── Render a single MFE fragment (SSR + client script tag) ──

async function renderFragment(name: string): Promise<string> {
  const renderer = renderers[name];
  const entry = manifest[name];

  if (!renderer || !entry) {
    console.warn(`[shell] No renderer for "${name}" → using fallback`);
    return FALLBACKS[name] ?? `<div class="fragment-fallback">${name} unavailable</div>`;
  }

  try {
    const result = await renderer({ apiBase: API_BASE });
    const parts: string[] = [result.html];

    // Serialize state for hydration
    if (result.state) {
      parts.push(
        `<script type="application/json" id="${result.state.id}">${JSON.stringify(result.state.data)}</script>`,
      );
    }

    // Client bundle for hydration (loaded from registry)
    parts.push(`<script src="${entry.entry}"></script>`);

    return parts.join('\n');
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    console.warn(`[shell] Render failed for "${name}" (${reason}) → using fallback`);
    return FALLBACKS[name] ?? `<div class="fragment-fallback">${name} unavailable</div>`;
  }
}

// ── Serve shared assets ──

app.use('/shared', express.static(path.resolve(__dirname, '../../shared')));

// ── Compose the page from fragments ──

app.get('/', async (_req, res) => {
  const [header, createTodo, todoList] = await Promise.all([
    renderFragment('header'),
    renderFragment('createTodo'),
    renderFragment('todoList'),
  ]);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo App — Micro-Frontend POC</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✅</text></svg>">
  <link rel="stylesheet" href="/shared/styles.css">
</head>
<body>
  ${header}
  <main class="main-content">
    <div class="app-container">
      ${createTodo}
      ${todoList}
    </div>
  </main>
</body>
</html>`);
});

// ── Startup: load manifest with retry, then poll for changes ──

async function loadWithRetry(maxAttempts = 10, delayMs = 500): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[shell] Fetching manifest from ${REGISTRY_URL}/manifest`);
      await refreshManifest();
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(`[shell] Registry not ready (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

try {
  await loadWithRetry();
} catch (err) {
  console.warn('[shell] Could not load manifest after retries — will serve with fallbacks:', err);
}

startManifestPolling();
console.log(`[shell] Polling manifest every ${MANIFEST_POLL_MS / 1000}s`);

app.listen(PORT, () => {
  console.log(`[shell] Edge composer running at http://localhost:${PORT}`);
});
