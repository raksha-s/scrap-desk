import { useCallback, useEffect, useRef, useState } from 'react';
import { folderSkins } from '../../engine/manifest';
import { go } from '../../route';
import { NAME_MAX } from '../../state/store';
import { useApp, useStore } from '../../state/useApp';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Back } from '../../ui/icons';
import { plural } from '../../ui/plural';
import { useEscape } from '../../ui/useEscape';
import { FolderMenu, type MenuState } from './FolderMenu';
import { PageCard } from './PageCard';

/** `folderId` is the folder shown, or the one last shown, so it stays put while the screen fades away. */
export function FolderView({ active, folderId, onAddNew }: { active: boolean; folderId: string | null; onAddNew(folderId: string): void }) {
  const store = useStore();
  const folder = useApp((s) => s.folders.find((f) => f.id === folderId));
  const allPages = useApp((s) => s.pages);
  const pages = allPages.filter((p) => p.folderId === folderId);
  const [menu, setMenu] = useState<MenuState>('closed');
  const [draft, setDraft] = useState<string | null>(null);      // the name being typed
  const renaming = useRef<string | null>(null);                 // id of the folder being renamed
  const input = useRef<HTMLInputElement>(null);
  const [asking, setAsking] = useState(false);
  const [visit, setVisit] = useState(0);                        // thumbnails slide in again on each visit

  const endRename = useCallback((save: boolean, value?: string) => {
    const id = renaming.current; if (!id) return;
    renaming.current = null; setDraft(null);
    if (save && value !== undefined) store.renameFolder(id, value);
  }, [store]);

  useEffect(() => {
    if (!active) return;
    endRename(false); setMenu('closed'); setAsking(false); setVisit((v) => v + 1);
  }, [active, folderId, endRename]);
  useEffect(() => { if (draft !== null && document.activeElement !== input.current) { input.current?.focus(); input.current?.select(); } }, [draft !== null]);

  const focusMore = () => document.getElementById('fvMore')?.focus({ preventScroll: true });
  useEscape(active, () => {
    if (menu !== 'closed') { setMenu('closed'); focusMore(); } else go('/');
  });

  const n = pages.length;
  return (
    <section id="folderView" className={`view${active ? ' is-active' : ''}${folder && folderSkins[folder.skin]?.dark ? ' on-dark' : ''}`} aria-label="Folder" inert={!active}>
      {folder && (
        <>
          <header className="fv-head">
            <button type="button" className="key key-solo" id="fvBack" aria-label="Back to folders" title="Back to folders" onClick={() => go('/')}><Back /></button>
            <div className="fv-title">
              <div className="fv-name-row">
                <h2 title={folder.name} hidden={draft !== null}>{folder.name}</h2>
                {draft !== null && (
                  <input type="text" ref={input} value={draft} maxLength={NAME_MAX} aria-label="Folder name" autoComplete="off" enterKeyHint="done"
                    onChange={(e) => setDraft(e.target.value)} onBlur={(e) => endRename(true, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== 'Escape') return;
                      e.preventDefault(); e.stopPropagation(); endRename(e.key === 'Enter', e.currentTarget.value); focusMore();
                    }} />
                )}
              </div>
              <p className="mono-meta">{n ? plural(n, 'page') : 'empty folder'}</p>
            </div>
            <div className="fv-actions">
              <button type="button" className="key key-solo" id="fvNew" aria-label="Add New" onClick={() => onAddNew(folder.id)}><span>+<span className="long"> Add New</span></span></button>
              <FolderMenu state={menu} onState={setMenu} skin={folder.skin}
                onRename={() => { setMenu('closed'); renaming.current = folder.id; setDraft(folder.name); }}
                onSkin={(skin) => store.recolorFolder(folder.id, skin)} onDelete={() => setAsking(true)} />
            </div>
          </header>
          <div className="fv-scroll">
            <div className="fv-grid" key={`${folder.id}-${visit}`}>
              {!n && <p className="fv-empty">Nothing in here yet — your first page will land in this folder.</p>}
              {pages.map((p, i) => <PageCard key={p.id} page={p} index={i} onOpen={() => go(`/p/${p.id}`)} />)}
              <button type="button" className="page-card new" style={{ ['--i' as string]: n }} onClick={() => onAddNew(folder.id)}>
                <div className="thumb"><span><b>+</b>Start a page here</span></div>
              </button>
            </div>
          </div>
          <ConfirmDialog open={asking} title={`Delete “${folder.name}”?`}
            body={n ? `This permanently deletes the folder and its ${plural(n, 'page')}.` : 'This permanently deletes the folder.'}
            onCancel={() => setAsking(false)}
            onConfirm={() => { setAsking(false); go('/'); store.deleteFolder(folder.id); }} />
        </>
      )}
    </section>
  );
}
