import { lazy, Suspense } from 'react';

const Trial = import.meta.env.DEV ? lazy(() => import('./features/export/Trial').then((m) => ({ default: m.Trial }))) : null;

export function App() {
  if (Trial && location.hash === '#/dev/export') return <Suspense><Trial /></Suspense>;
  return <h1>Scrap Desk</h1>;
}
