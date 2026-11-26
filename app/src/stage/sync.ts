// Tells the 3D desk about changes, touching only what changed so folders don't blink or jump.
import type { Page } from '../engine/types';
import type { Stage, StageFolder } from './Stage';

export type SyncTarget = Pick<Stage, 'setFolders' | 'rename' | 'recolor' | 'setContent'>;

export function syncStage(stage: SyncTarget, before: StageFolder[] | null, after: StageFolder[]): void {
  if (!before || before.length !== after.length || before.some((f, i) => f.id !== after[i].id)) {
    stage.setFolders(after.map((f) => ({ ...f })));         // the stage keeps and edits its own copies
    return;
  }
  after.forEach((f, i) => {
    const was = before[i];
    if (was.name !== f.name) stage.rename(i, f.name);
    if (was.pages !== f.pages || was.peek?.src !== f.peek?.src) stage.setContent(i, { pages: f.pages, peek: f.peek });
    if (was.skin !== f.skin) stage.recolor(i, f.skin);
  });
}

/** The picture that peeks out of a folder: the last photo or camera shot on its newest page that has one. */
export function peekImageId(pages: Page[], folderId: string): string | null {
  const newest = pages.filter((p) => p.folderId === folderId).sort((a, b) => b.createdAt - a.createdAt);
  for (const p of newest) {
    const card = [...p.cards].reverse().find((c) => c.kind === 'photo' || c.kind === 'camera');
    if (card) return card.imageId;
  }
  return null;
}
