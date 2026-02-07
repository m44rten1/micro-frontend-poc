import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Header } from './Header.js';

interface RenderContext {
  apiBase: string;
}

interface RenderResult {
  html: string;
  state?: { id: string; data: unknown };
}

export async function render(context: RenderContext): Promise<RenderResult> {
  let openCount = 0;
  let totalCount = 0;

  try {
    const response = await fetch(`${context.apiBase}/api/todos`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { openCount: number; totalCount: number };
    openCount = data.openCount;
    totalCount = data.totalCount;
  } catch (err) {
    console.warn('[mfe-header] Could not fetch todo counts:', err);
  }

  const html = renderToString(
    createElement(Header, { initialOpenCount: openCount, initialTotalCount: totalCount }),
  );

  return {
    html: `<div id="mfe-header">${html}</div>`,
    state: { id: 'mfe-header-data', data: { openCount, totalCount } },
  };
}
