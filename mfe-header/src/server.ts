import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Header } from './Header.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use('/static', express.static(path.resolve(__dirname, '../dist')));

// ── SSR fragment ──

app.get('/fragment', async (_req, res) => {
  let openCount = 0;
  let totalCount = 0;

  try {
    const response = await fetch('http://localhost:3002/api/todos');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { openCount: number; totalCount: number };
    openCount = data.openCount;
    totalCount = data.totalCount;
  } catch (err) {
    console.warn('[mfe-header] Could not fetch todo counts from mfe-todo-list:', err);
  }

  const html = renderToString(
    createElement(Header, { initialOpenCount: openCount, initialTotalCount: totalCount })
  );

  const stateJson = JSON.stringify({ openCount, totalCount });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(
    `<div id="mfe-header">${html}</div>\n` +
    `<script type="application/json" id="mfe-header-data">${stateJson}</script>\n` +
    `<script src="http://localhost:3001/static/client.js"></script>`
  );
});

app.listen(PORT, () => {
  console.log(`[mfe-header] Running at http://localhost:${PORT} (React)`);
});
