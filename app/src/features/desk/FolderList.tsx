import type { CSSProperties } from 'react';
import { skinColor } from '../../engine/manifest';
import type { Folder, Page } from '../../engine/types';
import { plural } from '../../ui/plural';

export function FolderList({ folders, pages, onOpen }: { folders: Folder[]; pages: Page[]; onOpen(id: string): void }) {
  return (
    <ul id="folderList" className="folder-list">
      {folders.map((f, i) => {
        const n = pages.filter((p) => p.folderId === f.id).length;
        return (
          <li key={f.id}>
            <button type="button" className="folder-row" onClick={() => onOpen(f.id)}
              style={{ '--c': skinColor(f.skin), '--i': i, '--r': `${(((i * 53) % 5) - 2) * 0.35}deg` } as CSSProperties}>
              <span className="chip" /><span><h3>{f.name}</h3><p>{n ? plural(n, 'page') : 'empty'}</p></span><span className="go">→</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
