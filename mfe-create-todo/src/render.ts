import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import CreateTodo from './CreateTodo.vue';

interface RenderResult {
  html: string;
  state?: { id: string; data: unknown };
}

export async function render(): Promise<RenderResult> {
  const vueApp = createSSRApp(CreateTodo);
  const html = await renderToString(vueApp);

  return {
    html: `<div id="mfe-create-todo">${html}</div>`,
  };
}
