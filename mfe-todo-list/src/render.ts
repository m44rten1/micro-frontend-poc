import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { Todo } from '@mfe/shared/types';
import TodoList from './TodoList.vue';

interface RenderContext {
  apiBase: string;
}

interface RenderResult {
  html: string;
  state?: { id: string; data: unknown };
}

export async function render(context: RenderContext): Promise<RenderResult> {
  let todos: Todo[] = [];

  try {
    const apiRes = await fetch(`${context.apiBase}/api/todos`);
    if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);
    const data = (await apiRes.json()) as { todos: Todo[] };
    todos = data.todos;
  } catch (err) {
    console.warn('[mfe-todo-list] Could not fetch todos:', err);
  }

  const vueApp = createSSRApp(TodoList, { initialTodos: todos });
  const html = await renderToString(vueApp);

  return {
    html: `<div id="mfe-todo-list">${html}</div>`,
    state: { id: 'mfe-todo-list-data', data: todos },
  };
}
