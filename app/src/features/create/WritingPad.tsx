// "Add New" writing pad: one question per sheet — folder → date(s) (required) → story → up to 6 photos → Generate.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { nextSkin } from '../../engine/manifest';
import type { Folder } from '../../engine/types';
import { importMany } from '../../images/import';
import { play } from '../../sound/sound';
import { NAME_MAX } from '../../state/store';
import { Dialog } from '../../ui/Dialog';
import { FolderArt } from '../../ui/FolderArt';
import { toast } from '../../ui/toast';
import { addPhotos, canAdvance, canGenerate, dateError, MAX_PHOTOS, STORY_MAX, type Draft, type DraftPhoto } from './form';

interface Props {
  open: boolean; initial: Draft; folders: Folder[];
  onClose(draft: Draft): void; onGenerate(draft: Draft): void;
  importer?: typeof importMany;
}

export function WritingPad(props: Props) {
  const latest = useRef(props.initial);
  return (
    <Dialog open={props.open} onClose={() => props.onClose(latest.current)} className="dlg dlg-create" id="createDlg" label="A new page">
      <Pad {...props} latest={latest} />
    </Dialog>
  );
}

function Pad({ initial, folders, onClose, onGenerate, importer = importMany, latest }: Props & { latest: { current: Draft } }) {
  const [d, setDraft] = useState<Draft>(initial);
  latest.current = d;
  // coming back after a failed save: straight to the sheet with Generate on it
  const [page, setPage] = useState(() => (initial.touched && canGenerate(initial) ? 3 : 0));
  const [importing, setImporting] = useState(0);
  const [over, setOver] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  const change = (patch: Partial<Draft>) => setDraft((now) => ({ ...now, ...patch }));
  // a folder deleted since the pad was filled in no longer counts as chosen
  const answers: Draft = d.folder && d.folder !== 'new' && !folders.some((f) => f.id === d.folder) ? { ...d, folder: null } : d;
  const leaf = (n: number) => form.current!.querySelector<HTMLElement>(`.leaf[data-page="${n}"]`)!;

  const turnTo = (n: number) => {
    const to = Math.max(0, Math.min(3, n));
    if (to !== page) setPage(to);
  };
  const turned = useRef(page);
  useEffect(() => {
    if (turned.current === page) return;
    turned.current = page; play('page');
    // no surprise keyboard on touch screens
    const typing = matchMedia('(pointer: fine)').matches && leaf(page).querySelector<HTMLElement>('textarea, input[type="date"]');
    (typing || leaf(page).querySelector<HTMLElement>('h3')!).focus({ preventScroll: true });
  }, [page]);

  const next = () => {
    if (page === 1 && !canAdvance(answers, 1)) { change({ touched: true }); return; }
    if (page < 3 && canAdvance(answers, page as 0 | 1 | 2)) turnTo(page + 1);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (page < 3) { next(); return; }
    if (importing) return;
    if (!canGenerate(answers)) { change({ touched: true }); turnTo(canAdvance(answers, 0) ? 1 : 0); return; }
    onGenerate({ ...answers, touched: true });
  };
  // Enter in a one-line field turns the page; only the last sheet generates
  const enter = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.key !== 'Enter' || !t.matches('input:not([type="file"])')) return;
    e.preventDefault(); if (page < 3) next(); else form.current!.requestSubmit();
  };

  const addFiles = async (list: FileList | null) => {
    // some browsers give HEIC files no type at all: let those through, to be reported if unreadable
    const files = [...(list ?? [])].filter((f) => f.type === '' || f.type.startsWith('image/'));
    if (!files.length) return;
    const room = MAX_PHOTOS - latest.current.photos.length;
    const tooMany = files.length > room;
    if (tooMany) toast(`Up to ${MAX_PHOTOS} photos per page — added the first ${Math.max(0, room)}.`);
    setImporting((n) => n + 1);
    const { images, failed } = await importer(files.slice(0, Math.max(0, room)));
    if (!live.current) return;
    setImporting((n) => n - 1);
    if (failed.length) toast(`Couldn't read ${failed.join(', ')}.`);
    const ready = images.map((i) => ({ ...i, url: URL.createObjectURL(i.blob) }));
    addPhotos(latest.current, ready).extra.forEach((p) => URL.revokeObjectURL(p.url));
    setDraft((now) => addPhotos(now, ready).draft);
  };
  const removePhoto = (photo: DraftPhoto) => {
    URL.revokeObjectURL(photo.url);
    setDraft((now) => ({ ...now, photos: now.photos.filter((p) => p.id !== photo.id) }));
  };

  const error = dateError(d);
  const choose = (folder: string) => {
    change({ folder });
    if (folder === 'new') setTimeout(() => { const i = form.current?.querySelector<HTMLInputElement>('#newFolderName'); i?.scrollIntoView?.({ block: 'nearest' }); i?.select(); }, 0);
  };
  const tile = (id: string, label: string, skin: string) => (
    <button key={id} type="button" role="radio" className={`folder-tile${id === 'new' ? ' is-new' : ''}`} aria-checked={answers.folder === id} onClick={() => choose(id)}>
      <FolderArt skin={skin} /><span className="folder-name">{label}</span>
    </button>
  );

  const sheet = (n: number, title: string, fields: ReactNode, forward: ReactNode, kicker?: string) => (
    <section className={`leaf${n < page ? ' is-turned' : ''}`} data-page={n} aria-label={`Step ${n + 1} of 4`} inert={n !== page}>
      <div className="leaf-back" aria-hidden="true" />
      <div className="leaf-front">
        <div className="leaf-body">
          {kicker && <p className="leaf-kicker">{kicker}</p>}
          <h3 tabIndex={-1}>{title}</h3>
          {fields}
          <footer className="leaf-foot">
            {n ? <button type="button" className="key key-solo" onClick={() => turnTo(n - 1)}><span>Back</span></button> : <span />}
            <span className="leaf-no">{n + 1} / 4</span>
            {forward}
          </footer>
        </div>
      </div>
    </section>
  );
  const nextKey = (n: 0 | 1 | 2) => <button type="button" className="key key-solo" data-next disabled={!canAdvance(answers, n)} onClick={next}><span>Next</span></button>;

  return (
    <form ref={form} method="dialog" id="createForm" noValidate onSubmit={submit} onKeyDown={enter}>
      <div className="pad" id="pad">
        <img className="pad-layer" src="art/ui/clipboard/board.png" alt="" />
        {sheet(0, 'Which folder?', (
          <div className="leaf-fields">
            <div className="folder-grid" id="folderGrid" role="radiogroup" aria-label="Folder">
              {folders.map((f) => tile(f.id, f.name, f.skin))}
              {tile('new', 'New folder', nextSkin(folders.map((f) => f.skin)))}
            </div>
            <label className="newfolder" id="newFolderWrap" hidden={answers.folder !== 'new'}><span>Folder name</span>
              <input type="text" id="newFolderName" maxLength={NAME_MAX} value={d.newName} autoComplete="off" onChange={(e) => change({ newName: e.target.value })} /></label>
          </div>
        ), nextKey(0), 'A new page')}
        {sheet(1, 'When was it?', (
          <div className="leaf-fields">
            <div className="seg" role="group" aria-label="Date type">
              {(['day', 'range'] as const).map((k) => (
                <button key={k} type="button" className={`seg-opt${d.kind === k ? ' is-on' : ''}`} aria-pressed={d.kind === k} onClick={() => change({ kind: k })}>{k === 'day' ? 'One day' : 'Date range'}</button>
              ))}
            </div>
            <div className="dates">
              <label><span>{d.kind === 'range' ? 'From' : 'Date'}</span>
                <input type="date" id="dStart" required value={d.start} onChange={(e) => change({ start: e.target.value, touched: true })} /></label>
              {d.kind === 'range' && (
                <label id="endWrap"><span>Until</span>
                  <input type="date" id="dEnd" required min={d.start || undefined} value={d.end} onChange={(e) => change({ end: e.target.value, touched: true })} /></label>
              )}
            </div>
            {error && <p className="err" role="alert">{error}</p>}
          </div>
        ), nextKey(1))}
        {sheet(2, 'What happened?', (
          <div className="leaf-fields leaf-write">
            <textarea id="story" maxLength={STORY_MAX} aria-label="What happened?" value={d.story} onChange={(e) => change({ story: e.target.value })} />
            <p className="mono-meta"><span id="storyCount">{d.story.length}</span> / {STORY_MAX}</p>
          </div>
        ), nextKey(2))}
        {sheet(3, 'Photos', (
          <div className={`leaf-fields${over ? ' over' : ''}`} id="photoPick"
            onDragEnter={(e) => { e.preventDefault(); setOver(true); }} onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
            onDrop={(e) => { e.preventDefault(); setOver(false); void addFiles(e.dataTransfer.files); }}>
            <input type="file" ref={fileInput} accept="image/*" multiple hidden onChange={(e) => { const picked = e.target.files; void addFiles(picked); e.target.value = ''; }} />
            <ul className="slots" id="slots" aria-label="Six photo slots">
              {Array.from({ length: MAX_PHOTOS }, (_, i) => {
                const p = d.photos[i];
                return p ? (
                  <li key={p.id} className="slot-full" style={{ ['--r' as string]: `${(((i * 37) % 7) - 3) * 0.8}deg` }}>
                    <img src={p.url} alt={`Photo ${i + 1}`} />
                    <button type="button" className="slot-x" aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(p)}>×</button>
                  </li>
                ) : (
                  <li key={`empty-${i}`}><button type="button" className="slot-add" aria-label={`Add a photo, slot ${i + 1} of ${MAX_PHOTOS}`} onClick={() => fileInput.current!.click()} /></li>
                );
              })}
            </ul>
          </div>
        ), <button type="submit" className="key key-solo" id="btnGenerate" disabled={!canGenerate(answers) || importing > 0}><span>Generate</span></button>)}
        <img className="pad-layer pad-clip" src="art/ui/clipboard/clip.png" alt="" />
        <button type="button" className="x" aria-label="Close" onClick={() => onClose(latest.current)}>×</button>
      </div>
    </form>
  );
}
