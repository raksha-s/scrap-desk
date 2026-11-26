// A page: items on a 900 × 1200 sheet. Same structure and class names as the prototype, so its styles apply unchanged.
import type { CSSProperties, ReactNode } from 'react';
import { art } from '../../engine/manifest';
import type { ArtList, ArtType, Card, FrameId, Item, Page, PhotoItem } from '../../engine/types';
import { useImageUrl } from '../../images/urls';
import { useStore } from '../../state/useApp';

const TABLE: Record<ArtType, ArtList> = { stamp: 'stamps', leaf: 'leaves', pattern: 'patterns', sticker: 'stickers', flower: 'flowers', cat: 'cats', paper: 'papers' };
export const FRAMES: [FrameId, string][] = [['polaroid', 'Polaroid'], ['instax', 'Instax'], ['film', 'Film strip'], ['kraft', 'Kraft mat'], ['round', 'Rounded'], ['torn', 'Torn edge']];
const LABELS = ['#c9573c', '#2f6f8a', '#c79a2b', '#7a4a8a', '#3d7a52'];

export function cardCaption(card: Card, page: Page): string {
  if (card.caption != null) return card.caption;
  if (card.kind === 'album' && card.album) return card.album.title.slice(0, 26);
  return page.direction.dateShort;
}

type Vars = CSSProperties & Record<`--${string}`, string | number>;
type ImageUrl = (imageId: string) => string | undefined;

export interface SheetProps {
  page: Page;
  imageUrl?: ImageUrl;
  enter?: boolean;
  editing?: boolean;
  selectedId?: string | null;
  freshCardId?: string;
  addedIds?: string[];
}

export function Sheet({ page, imageUrl, enter, editing, selectedId, freshCardId, addedIds }: SheetProps) {
  const p = page.direction.palette;
  const cls = ['sheet', `paper-${p.paperKind}`, editing && 'editing', enter && 'enter'].filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ '--ink': p.ink, '--accent': p.accent, '--photo-filter': p.filter } as Vars}>
      <div className="holes" />
      {page.items.map((it) => (
        <Piece key={it.id} it={it} page={page} imageUrl={imageUrl}
          extra={[it.id === selectedId && 'is-sel', addedIds?.includes(it.id) && 'pop']}
          fresh={it.type === 'photo' && it.cardId === freshCardId} />
      ))}
    </div>
  );
}

interface PieceProps { it: Item; page: Page; imageUrl?: ImageUrl; extra: (string | false | undefined)[]; fresh: boolean }

function Piece({ it, page, imageUrl, extra, fresh }: PieceProps) {
  const frame = (classes: (string | false)[], children: ReactNode, vars: Vars = {}) => (
    <div className={['it', it.type, ...classes, ...extra].filter(Boolean).join(' ')} data-id={it.id}
      style={{ left: it.x - it.w / 2, top: it.y - it.h / 2, width: it.w, height: it.h, transform: `rotate(${it.rot}deg)`, '--z': it.z, '--d': it.d || 0, ...vars } as Vars}>
      {children}
    </div>
  );

  switch (it.type) {
    case 'photo': {
      const card = page.cards.find((c) => c.id === it.cardId);
      if (!card) return null;
      const album = card.kind === 'album';
      const torn = it.frame === 'torn';
      const vars: Vars = {};
      if (torn) vars['--torn'] = (it as PhotoItem).torn;
      if (album) vars['--lab'] = LABELS[(card.id.length + (card.album?.title || '').length) % LABELS.length];
      return frame([`fr-${it.frame}`, torn && 'has-clip', album && 'album', fresh && 'developing'], (
        <>
          {album && <div className="rec" />}
          <Photo card={card} imageUrl={imageUrl} />
          <div className="cap" data-ph="add a note">{cardCaption(card, page)}</div>
        </>
      ), vars);
    }
    case 'note':
      return frame(['has-clip'], (
        <div className={`pnote ${it.kind}`} style={{ '--fs': `${it.fs}px`, '--lh': `${it.lh}px`, '--torn': it.torn } as Vars}>
          {it.text}<span className="sig">{it.sig}</span>
        </div>
      ));
    case 'title':
      return frame([], <><h2>{it.text}</h2><span className="chip">{it.chip}</span></>, { '--tfs': `${it.tfs}px` });
    case 'quote':
      return frame([], (
        <>
          <q>{it.text}</q>
          <svg viewBox="0 0 340 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 12 C 50 3, 98 17, 150 9 S 262 5, 337 11" /></svg>
        </>
      ), { '--qfs': `${it.qfs}px` });
    case 'tape':
      return frame([], <div className={`tstrip t-${it.kind}`} />);
    case 'scrap':
      return frame([!!it.mono && 'mono'], it.text, { '--sfs': '28px' });
    default: {
      const list = TABLE[it.type];
      const a = list && art[list][it.art];
      if (!a) return null;                                  // art that is no longer shipped is simply left off
      return frame([], <img src={a.file} className="art" alt="" draggable={false} />);
    }
  }
}

function Photo({ card, imageUrl }: { card: Card; imageUrl?: ImageUrl }) {
  const store = useStore();
  const stored = useImageUrl(imageUrl ? '' : card.imageId, store.image);
  const src = imageUrl ? imageUrl(card.imageId) : stored;
  const alt = card.kind === 'album' && card.album ? `${card.album.title} — ${card.album.artist}` : 'Photo';
  return <div className="ph">{src && <img src={src} alt={alt} draggable={false} />}</div>;
}
