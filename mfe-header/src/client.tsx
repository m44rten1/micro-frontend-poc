import { hydrateRoot } from 'react-dom/client';
import { Header } from './Header.js';

const container = document.getElementById('mfe-header');
if (container) {
  const dataEl = document.getElementById('mfe-header-data');
  const data = JSON.parse(dataEl?.textContent || '{}');

  hydrateRoot(
    container,
    <Header
      initialOpenCount={data.openCount ?? 0}
      initialTotalCount={data.totalCount ?? 0}
    />
  );

  console.log('[mfe-header] Hydrated (React)');
}
