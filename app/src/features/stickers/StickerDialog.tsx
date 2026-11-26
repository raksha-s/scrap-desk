// Sticker picker: every cut-out in the library, grouped, one tap to put it on the page.
import { useState } from 'react';
import { manifestList } from '../../engine/manifest';
import type { ArtList, ArtType } from '../../engine/types';
import { Dialog } from '../../ui/Dialog';

// manifest list → tab label → the item type the sheet draws it as
const GROUPS: [ArtList, string, ArtType][] = [
  ['cats', 'Cats', 'cat'], ['flowers', 'Flowers', 'flower'], ['stamps', 'Wax seals', 'stamp'], ['stickers', 'Clips & pins', 'sticker'],
  ['leaves', 'Leaves', 'leaf'], ['papers', 'Paper', 'paper'], ['patterns', 'Patterns', 'pattern'],
];
let lastTab: ArtList = 'cats';                                 // reopens on the tab used last

interface Props { open: boolean; onPick(type: ArtType, artId: string): void; onClose(): void }

export function StickerDialog(props: Props) {
  return (
    <Dialog open={props.open} onClose={props.onClose} className="dlg dlg-stickers" id="stickerDlg" labelledBy="sTitle">
      <Picker {...props} />
    </Dialog>
  );
}

function Picker({ onPick, onClose }: Props) {
  const [tab, setTab] = useState<ArtList>(lastTab);
  const type = GROUPS.find((g) => g[0] === tab)![2];
  return (
    <>
      <header className="dlg-head"><h2 id="sTitle">Add a sticker</h2><button type="button" className="x" aria-label="Close" onClick={onClose}>×</button></header>
      <div className="stk-tabs" id="stkTabs" role="group" aria-label="Sticker type">
        {GROUPS.map(([key, label]) => <button key={key} type="button" className="chipbtn" aria-pressed={tab === key} onClick={() => { lastTab = key; setTab(key); }}>{label}</button>)}
      </div>
      <ul className="stk-grid" id="stkGrid" key={tab}>
        {manifestList(tab).map((a) => {
          const name = a.id.replace(/-/g, ' ');
          return <li key={a.id}><button type="button" aria-label={`Add ${name}`} title={name} onClick={() => onPick(type, a.id)}><img src={a.file} alt="" loading="lazy" draggable={false} /></button></li>;
        })}
      </ul>
    </>
  );
}
