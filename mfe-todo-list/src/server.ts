import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import TodoList from './TodoList.js';
import { getAllTodos, addTodo, toggleTodo, getOpenCount, getTotalCount } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3002;

app.use(express.json());
app.use('/static', express.static(path.resolve(__dirname, '../dist')));

// ── CORS (needed because browser is on :3000, API is on :3002) ──

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// ── REST API (data owned by this micro-frontend) ──

app.get('/api/todos', (_req, res) => {
  res.json({
    todos: getAllTodos(),
    openCount: getOpenCount(),
    totalCount: getTotalCount(),
  });
});

app.post('/api/todos', (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  const todo = addTodo(text.trim());
  res.status(201).json({ todo });
});

app.patch('/api/todos/:id/toggle', (req, res) => {
  const todo = toggleTodo(req.params.id);
  if (!todo) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ todo, openCount: getOpenCount(), totalCount: getTotalCount() });
});

// ── SSR fragment ──

app.get('/fragment', async (_req, res) => {
  const todos = getAllTodos();
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
