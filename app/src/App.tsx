import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ruleDirector } from './engine/director';
import { emptyDraft, type Draft } from './features/create/form';
import { generatePage, SaveFailed } from './features/create/generate';
import { Generating, type Narration } from './features/create/Generating';
import { WritingPad } from './features/create/WritingPad';
import { measureNote, noteFontsReady } from './features/page/measureNote';
import { PageView } from './features/page/PageView';
import { Desk, type DeskMode } from './features/desk/Desk';
import { FolderView } from './features/folder/FolderView';
import { go, parseRoute, resolveRoute, useHash, type Route } from './route';
import { play, wireButtonSounds } from './sound/sound';
import { StageCanvas } from './stage/StageCanvas';
import { useStageFolders } from './stage/usePeeks';
import { SAVE_ERROR } from './state/store';
import { useApp, useStore } from './state/useApp';
import { toast, Toaster } from './ui/toast';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GENERATING_MIN = 2600;

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
  const lastPage = useRef<string | null>(null);
  if (route.view === 'page') lastPage.current = route.id;

  const [chosen, setMode] = useState<DeskMode>('folders');
  const [webgl, setWebgl] = useState(true);
  const mode: DeskMode = webgl ? chosen : 'list';

  const was = useRef<Route['view']>('home');
  useEffect(() => { viewSound(was.current, route.view); was.current = route.view; document.body.dataset.view = route.view; }, [route.view]);

  const stageFolders = useStageFolders(folders, pages);
  const open = (id: string) => go(`/f/${id}`);
  const { pad, narration, addNew, closePad, generate } = useAddNew();

  return (
    <>
      <StageCanvas folders={stageFolders} view={route.view === 'home' ? (mode === 'list' ? 'list' : 'home') : route.view}
        selected={folders.findIndex((f) => f.id === lastFolder.current)} onOpen={open} onUnavailable={() => setWebgl(false)} />
      <Desk active={route.view === 'home'} mode={mode} webgl={webgl} onMode={setMode} onOpen={open} onAddNew={() => addNew(null)} />
      <FolderView active={route.view === 'folder'} folderId={lastFolder.current} onAddNew={addNew} />
      <PageView active={route.view === 'page'} pageId={lastPage.current} />
      {pad && <WritingPad open initial={pad} folders={folders} onClose={closePad} onGenerate={generate} />}
      <Generating narration={narration} />
      {saveError && <div className="save-error" role="alert">{saveError}</div>}
      <Toaster />
    </>
  );
}

/** The "Add New" flow: writing pad → "reading your story" → the new page, assembling. */
function useAddNew() {
  const store = useStore();
  const [pad, setPad] = useState<Draft | null>(null);
  const [narration, setNarration] = useState<Narration | null>(null);
  const forget = (d: Draft) => d.photos.forEach((p) => URL.revokeObjectURL(p.url));

  async function generate(draft: Draft) {
    setPad(null);
    setNarration({ line: 'Reading your story…', sub: '', chips: [] });
    const began = performance.now();
    try {
      await noteFontsReady();
      const page = await generatePage(draft, {
        store, director: ruleDirector, measureNote,
        onStep: async (line, sub, chips, ms) => { setNarration((n) => ({ line, sub, chips: chips ?? n?.chips ?? [] })); await wait(ms); },
      });
      await wait(Math.max(0, GENERATING_MIN - (performance.now() - began)));
      forget(draft);
      setNarration(null);
      go(`/p/${page.id}`, { enter: page.id });
    } catch (e) {
      console.error(e);
      setNarration(null);
      setPad(draft);                                         // nothing typed is lost
      toast(e instanceof SaveFailed ? SAVE_ERROR : "Couldn't make this page. Your answers are still here.", 7000);
    }
  }

  return {
    pad, narration, generate,
    addNew: (folderId: string | null) => setPad(emptyDraft(folderId ?? undefined)),
    closePad: (d: Draft) => { forget(d); setPad(null); },
  };
}
