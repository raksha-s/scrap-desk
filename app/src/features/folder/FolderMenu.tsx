// The ⋮ beside + Add New: edit name, change color, delete.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { SKIN_NAMES, SKIN_ORDER, skinColor } from '../../engine/manifest';
import { FolderArt } from '../../ui/FolderArt';
import { Bin, Kebab, Pencil } from '../../ui/icons';

export type MenuState = 'closed' | 'menu' | 'colours';
interface Props { state: MenuState; onState(s: MenuState): void; skin: string; onRename(): void; onSkin(skin: string): void; onDelete(): void }

export function FolderMenu({ state, onState, skin, onRename, onSkin, onDelete }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(0);

  useEffect(() => {
    if (state === 'closed') return;
    const outside = (e: Event) => { if (!root.current!.contains(e.target as Node)) onState('closed'); };
    addEventListener('pointerdown', outside);
    return () => removeEventListener('pointerdown', outside);
  }, [state, onState]);
  useEffect(() => {
    if (state === 'menu') first.current?.focus({ preventScroll: true });
    if (state === 'colours') root.current!.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
  }, [state, opened]);

  const arrows = (e: KeyboardEvent) => {
    if (e.key === 'Tab') { onState('closed'); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...root.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    items[(items.indexOf(document.activeElement as HTMLElement) + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  };

  return (
    <div className="fv-more" ref={root}>
      <button type="button" className="kebab" id="fvMore" aria-label="Folder options" aria-haspopup="menu" aria-expanded={state === 'menu'}
        onClick={() => { setOpened((n) => n + 1); onState(state === 'menu' ? 'closed' : 'menu'); }}><Kebab /></button>
      <div className="fv-menu" role="menu" aria-label="Folder options" hidden={state !== 'menu'} onKeyDown={arrows}>
        <button type="button" role="menuitem" ref={first} onClick={onRename}><Pencil /><span>Edit name</span></button>
        <button type="button" role="menuitem" onClick={() => onState('colours')}><i className="swatch" aria-hidden="true" style={{ '--c': skinColor(skin) } as CSSProperties} /><span>Change color</span></button>
        <button type="button" role="menuitem" onClick={() => { onState('closed'); onDelete(); }}><Bin /><span>Delete folder</span></button>
      </div>
      {state === 'colours' && (
        // stays open, so colors can be tried one after another
        <div className="fv-colours" role="radiogroup" aria-label="Folder color">
          {[...SKIN_ORDER].sort().map((s) => (
            <button key={s} type="button" role="radio" aria-checked={skin === s} aria-label={SKIN_NAMES[s]} title={SKIN_NAMES[s]} onClick={() => onSkin(s)}><FolderArt skin={s} /></button>
          ))}
        </div>
      )}
    </div>
  );
}
