import express from 'express';
import { getAllTodos, addTodo, toggleTodo, getOpenCount, getTotalCount } from './store.js';

const app = express();
const PORT = 3004;

app.use(express.json());

// ── CORS (needed because browser is on :3000, API is on :3004) ──

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

// ── REST API ──

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

app.listen(PORT, () => {
  console.log(`[api-todo] REST API running at http://localhost:${PORT}`);
});
