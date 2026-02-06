import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { Todo } from '@mfe/shared/types';
import TodoList from './TodoList.vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3002;

const API_BASE = 'http://localhost:3004';

app.use('/static', express.static(path.resolve(__dirname, '../dist')));

// ── SSR fragment ──

app.get('/fragment', async (_req, res) => {
  let todos: Todo[] = [];

  try {
    const apiRes = await fetch(`${API_BASE}/api/todos`);
    if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);
    const data = (await apiRes.json()) as { todos: Todo[] };
    todos = data.todos;
  } catch (err) {
    console.warn('[mfe-todo-list] Could not fetch todos from API:', err);
  }

  const vueApp = createSSRApp(TodoList, { initialTodos: todos });
  const html = await renderToString(vueApp);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(
    `<div id="mfe-todo-list">${html}</div>\n` +
    `<script type="application/json" id="mfe-todo-list-data">${JSON.stringify(todos)}</script>\n` +
    `<script src="http://localhost:3002/static/client.js"></script>`
  );
});

app.listen(PORT, () => {
  console.log(`[mfe-todo-list] Running at http://localhost:${PORT} (Vue)`);
});
