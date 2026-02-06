import { createSSRApp } from 'vue';
import CreateTodo from './CreateTodo.js';

const container = document.getElementById('mfe-create-todo');
if (container) {
  const app = createSSRApp(CreateTodo);
  app.mount(container);

  console.log('[mfe-create-todo] Hydrated (Vue)');
}
