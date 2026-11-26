// The little toolbar over a piece: frame choices for photos, and rotate / resize / front / delete once selected.
import { useLayoutEffect, useState, type CSSProperties } from 'react';
import type { FrameId, Item } from '../../engine/types';
import { Bin, Minus, Plus, RotateLeft, RotateRight, ToFront } from '../../ui/icons';
import type { PieceAction } from './edits';
import { FRAMES } from './Sheet';

interface Props {
  item: Item | undefined; selected: boolean; tick: number;
  onFrame(f: FrameId): void; onAction(a: PieceAction): void; onEnter(): void; onLeave(): void;
}
const ACTIONS: [PieceAction, string, () => React.JSX.Element][] = [
  ['rot-l', 'Rotate left', RotateLeft], ['rot-r', 'Rotate right', RotateRight], ['smaller', 'Smaller', Minus],
  ['bigger', 'Bigger', Plus], ['front', 'Bring to front', ToFront], ['delete', 'Delete', Bin],
];

export function Bubble({ item, selected, tick, onFrame, onAction, onEnter, onLeave }: Props) {
  const [place, setPlace] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!item) return;
    const node = document.querySelector(`#pageView .it[data-id="${item.id}"]`); if (!node) return;
    const r = node.getBoundingClientRect(), below = r.top < 130;
    setPlace({ left: Math.min(innerWidth - 100, Math.max(100, r.left + r.width / 2)), top: below ? r.bottom + 10 : r.top - 8, transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)' });
  }, [item, tick]);

  const photo = item?.type === 'photo' ? item : null;
  return (
    <div className="bubble" id="bubble" hidden={!item || (!photo && !selected)} style={place} onPointerEnter={onEnter} onPointerLeave={onLeave}>
      {photo && (
        <div className="bubble-frames" role="group" aria-label="Frame">
          {FRAMES.map(([id, label]) => (
            <button key={id} type="button" className={`fr${photo.frame === id ? ' on' : ''}`} data-fr={id} aria-label={`${label} frame`} title={label} onClick={() => onFrame(id)}><i /></button>
          ))}
        </div>
      )}
      {item && selected && (
        <div className="bubble-actions" role="group" aria-label="Piece">
          {ACTIONS.map(([act, label, Icon]) => <button key={act} type="button" aria-label={label} title={label} onClick={() => onAction(act)}><Icon /></button>)}
        </div>
      )}
    </div>
  );
}
