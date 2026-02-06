import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

// ── Fragment sources (in production these would be service discovery / config) ──

const FRAGMENTS: Record<string, { url: string; fallback: string }> = {
  header: {
    url: 'http://localhost:3001/fragment',
    fallback: '<div id="mfe-header"><header class="header"><div class="header__inner"><h1 class="header__title">Todo App</h1></div></header></div>',
  },
  createTodo: {
    url: 'http://localhost:3003/fragment',
    fallback: '<div id="mfe-create-todo" class="fragment-fallback">Create form temporarily unavailable</div>',
  },
  todoList: {
    url: 'http://localhost:3002/fragment',
    fallback: '<div id="mfe-todo-list" class="fragment-fallback">Todo list temporarily unavailable</div>',
  },
};

const FRAGMENT_TIMEOUT_MS = 2000;

// ── Fetch a single fragment with timeout + fallback ──

async function fetchFragment(name: string): Promise<string> {
  const { url, fallback } = FRAGMENTS[name];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FRAGMENT_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    console.warn(`[shell] Fragment "${name}" unavailable (${reason}) → using fallback`);
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Serve shared assets ──

app.use('/shared', express.static(path.resolve(__dirname, '../../shared')));

// ── Compose the page from fragments ──

app.get('/', async (_req, res) => {
  const [header, createTodo, todoList] = await Promise.all([
    fetchFragment('header'),
    fetchFragment('createTodo'),
    fetchFragment('todoList'),
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

app.listen(PORT, () => {
  console.log(`[shell] Edge composer running at http://localhost:${PORT}`);
});
