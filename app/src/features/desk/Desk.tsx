import { useEffect, useState } from 'react';
import { useApp } from '../../state/useApp';
import { FolderList } from './FolderList';

export type DeskMode = 'folders' | 'list';
interface Props { active: boolean; mode: DeskMode; webgl: boolean; onMode(m: DeskMode): void; onOpen(folderId: string): void; onAddNew(): void }

export function Desk({ active, mode, webgl, onMode, onOpen, onAddNew }: Props) {
  const folders = useApp((s) => s.folders);
  const pages = useApp((s) => s.pages);
  // the rows slide in again each time the desk is shown
  const [visit, setVisit] = useState(0);
  useEffect(() => { if (active) setVisit((v) => v + 1); }, [active, mode]);

  const option = (m: DeskMode, side: 'tk-l' | 'tk-r', label: string, icon: string) => (
    <button type="button" className={`kc kc-sq ${side} toggle-opt`} data-mode={m} aria-pressed={mode === m} aria-label={label}
      disabled={m === 'folders' && !webgl} title={m === 'folders' && !webgl ? "3D view isn't available on this device" : undefined}
      onClick={() => onMode(m)}>
      <img className="glyph" src={`art/ui/cardboard/${icon}.png`} alt="" />
    </button>
  );

  return (
    <section id="home" className={`view${active ? ' is-active' : ''}`} aria-label="Your folders" inert={!active}>
      <header className="brand"><h1>Scrap Desk</h1></header>
      <div className="list-view" id="listView" hidden={mode !== 'list'}>
        {mode === 'list' && <FolderList key={visit} folders={folders} pages={pages} onOpen={onOpen} />}
      </div>
      <div className="controls">
        <div className="toggle" id="viewToggle" data-mode={mode} role="group" aria-label="View">
          {option('folders', 'tk-l', 'Folder view', 'icon_folder')}
          {option('list', 'tk-r', 'List view', 'icon_list')}
        </div>
        <button type="button" className="key key-solo" id="btnStart" onClick={onAddNew}><span>+ Add New</span></button>
      </div>
    </section>
  );
}
