import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import CreateTodo from './CreateTodo.vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3003;

app.use('/static', express.static(path.resolve(__dirname, '../dist')));

// ── SSR fragment ──

app.get('/fragment', async (_req, res) => {
  const vueApp = createSSRApp(CreateTodo);
  const html = await renderToString(vueApp);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(
    `<div id="mfe-create-todo">${html}</div>\n` +
    `<script src="http://localhost:3003/static/client.js"></script>`
  );
});

app.listen(PORT, () => {
  console.log(`[mfe-create-todo] Running at http://localhost:${PORT} (Vue)`);
});
