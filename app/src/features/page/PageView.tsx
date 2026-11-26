import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clearEntering, go, isEntering } from '../../route';
import { useApp, useStore } from '../../state/useApp';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Back, Bin, Download } from '../../ui/icons';
import { toast } from '../../ui/toast';
import { useEscape } from '../../ui/useEscape';
import { deliver, exportFilename } from '../export/deliver';
import { exportPage } from '../export/exportPage';
import { Bubble } from './Bubble';
import { applyAction, setCaption, setFrame } from './edits';
import { Sheet } from './Sheet';
import { useEditor } from './useEditor';
import { SERVICES, usePageTools, type PageServices } from './usePageTools';
import { useZoom } from './useZoom';
import { ZoomBar } from './ZoomBar';

interface Exporter { exportPage: typeof exportPage; deliver(blob: Blob, name: string): ReturnType<typeof deliver> }
const EXPORTER: Exporter = { exportPage, deliver: (blob, name) => deliver(blob, name) };

/** `pageId` is the page shown, or the one last shown, so it stays put while the screen fades away. */
export function PageView({ active, pageId, exporter = EXPORTER, services = SERVICES }: { active: boolean; pageId: string | null; exporter?: Exporter; services?: PageServices }) {
  const store = useStore();
  const page = useApp((s) => s.pages.find((p) => p.id === pageId));
  const folder = useApp((s) => s.folders.find((f) => f.id === page?.folderId));
  const shown = active && page ? page.id : null;

  const desk = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const editor = useEditor(page, shown);
  const { zoom, setZoom, reset, panHandlers } = useZoom({ desk, wrap }, shown, editor.refresh);
  const [asking, setAsking] = useState(false);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { setAsking(false); }, [shown]);

  // a freshly made page assembles itself, once
  const [entering, setEntering] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (shown && isEntering(shown)) { setEntering(shown); clearEntering(); }
    if (!shown) setEntering(null);
  }, [shown]);

  const tools = usePageTools(page, shown, editor.select, services);

  useEscape(active, () => { if (folder) go(`/f/${folder.id}`); });

  const item = shown ? page!.items.find((i) => i.id === (editor.selected ?? editor.hovered)) : undefined;

  async function onExport() {
    setExporting(true);
    try {
      const blob = await exporter.exportPage(page!, store.image);
      await exporter.deliver(blob, exportFilename(page!.start));
    } catch (e) {
      console.error(e); toast("Couldn't export this page. Try again.");
    } finally { setExporting(false); }
  }

  return (
    <>
      <section id="pageView" className={`view${active ? ' is-active' : ''}${zoom > 100 ? ' zoomed' : ''}`} aria-label="Journal page" inert={!active}>
        <div className="pv-top">
          <button type="button" className="key key-solo" id="pvBack" aria-label={folder ? `Back to ${folder.name}` : 'Back'} title={folder ? `Back to ${folder.name}` : undefined}
            onClick={() => go(folder ? `/f/${folder.id}` : '/')}><Back /></button>
          <p className="mono-meta" id="pvMeta">{page?.direction.dateChip}</p>
          <div className="pv-actions">
            <button type="button" className="key key-solo" id="pvDelete" aria-label="Delete page" title="Delete page" disabled={!page} onClick={() => setAsking(true)}><Bin /></button>
            <button type="button" className="key key-solo" id="toolExport" aria-label={exporting ? 'Exporting…' : 'Export'} disabled={!page || exporting} onClick={onExport}>
              <Download /><span>{exporting ? 'Exporting…' : 'Export'}</span></button>
          </div>
        </div>
        <div className="pv-desk" id="pvDesk" ref={desk} {...panHandlers}>
          <div className="sheet-wrap" id="sheetWrap" ref={wrap}>
            <div className="under u1" /><div className="under u2" />
            <div className="sheet-scale" id="sheetScale" {...editor.sheetHandlers}>
              {page && (
                <Sheet key={page.id} page={page} editing enter={entering === page.id} selectedId={editor.selected} draggingId={editor.dragging} addedIds={tools.addedIds} freshCardId={tools.freshCardId}
                  onCaption={(cardId, text) => store.updatePage(page.id, (p) => setCaption(p, cardId, text))} />
              )}
            </div>
          </div>
        </div>
        <ZoomBar zoom={zoom} onZoom={setZoom} onFit={reset} />
        {tools.tray}
      </section>

      <Bubble item={item} selected={!!editor.selected} tick={editor.tick} onEnter={editor.keepHover} onLeave={editor.dropHover}
        onFrame={(frame) => { if (item) { store.updatePage(page!.id, (p) => setFrame(p, item.id, frame)); editor.refresh(); } }}
        onAction={(action) => {
          if (!item) return;
          store.updatePage(page!.id, (p) => applyAction(p, item.id, action));
          if (action === 'delete') editor.select(null); else editor.refresh();
        }} />

      {tools.dialogs}

      <ConfirmDialog open={asking} title="Delete this page?" body="This permanently deletes the page and its photos." onCancel={() => setAsking(false)}
        onConfirm={() => { setAsking(false); const id = page!.id; go(folder ? `/f/${folder.id}` : '/'); store.deletePage(id); }} />
    </>
  );
}
