import { createSSRApp } from 'vue';
import type { Todo } from '@mfe/shared/types';
import TodoList from './TodoList.js';

const container = document.getElementById('mfe-todo-list');
if (container) {
  const dataEl = document.getElementById('mfe-todo-list-data');
  const initialTodos: Todo[] = JSON.parse(dataEl?.textContent || '[]');

  const app = createSSRApp(TodoList, { initialTodos });
  app.mount(container);

  console.log('[mfe-todo-list] Hydrated (Vue)');
}
