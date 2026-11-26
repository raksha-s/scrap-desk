import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Desk, type DeskMode } from './features/desk/Desk';
import { FolderView } from './features/folder/FolderView';
import { go, parseRoute, resolveRoute, useHash, type Route } from './route';
import { play, wireButtonSounds } from './sound/sound';
import { StageCanvas } from './stage/StageCanvas';
import { useStageFolders } from './stage/usePeeks';
import { useApp, useStore } from './state/useApp';
import { Toaster } from './ui/toast';

const Trial = import.meta.env.DEV ? lazy(() => import('./features/export/Trial').then((m) => ({ default: m.Trial }))) : null;

export function App() {
  if (Trial && location.hash === '#/dev/export') return <Suspense><Trial /></Suspense>;
  return <ScrapDesk />;
}

// paper sound for moving between the desk, a folder and a page
function viewSound(from: Route['view'], to: Route['view']) {
  if (from === to) return;
  play(to === 'home' ? 'close' : to === 'page' ? 'page' : from === 'home' ? 'open' : 'close');
}

function ScrapDesk() {
  const store = useStore();
  const ready = useApp((s) => s.ready);
  const folders = useApp((s) => s.folders);
  const pages = useApp((s) => s.pages);
  const saveError = useApp((s) => s.saveError);
  useEffect(() => { void store.init(); }, [store]);
  useEffect(() => wireButtonSounds(), []);

  const hash = useHash();
  const route: Route = ready ? resolveRoute(parseRoute(hash), { folders, pages }) : { view: 'home' };
  const folderId = route.view === 'folder' ? route.id : route.view === 'page' ? pages.find((p) => p.id === route.id)!.folderId : null;
  const lastFolder = useRef<string | null>(null);
  if (folderId) lastFolder.current = folderId;

  const [chosen, setMode] = useState<DeskMode>('folders');
  const [webgl, setWebgl] = useState(true);
  const mode: DeskMode = webgl ? chosen : 'list';

  const was = useRef<Route['view']>('home');
  useEffect(() => { viewSound(was.current, route.view); was.current = route.view; document.body.dataset.view = route.view; }, [route.view]);

  const stageFolders = useStageFolders(folders, pages);
  const open = (id: string) => go(`/f/${id}`);
  const addNew = (_folderId: string | null) => {};

  return (
    <>
      <StageCanvas folders={stageFolders} view={route.view === 'home' ? (mode === 'list' ? 'list' : 'home') : route.view}
        selected={folders.findIndex((f) => f.id === lastFolder.current)} onOpen={open} onUnavailable={() => setWebgl(false)} />
      <Desk active={route.view === 'home'} mode={mode} webgl={webgl} onMode={setMode} onOpen={open} onAddNew={() => addNew(null)} />
      <FolderView active={route.view === 'folder'} folderId={lastFolder.current} onAddNew={addNew} />
      {saveError && <div className="save-error" role="alert">{saveError}</div>}
      <Toaster />
    </>
  );
}
