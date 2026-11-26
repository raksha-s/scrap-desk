export const exportFilename = (start: string): string => `scrap-desk-${start}.png`;

export interface DeliverEnv { nav: Navigator; download(blob: Blob, name: string): void; touch: boolean }

function download(blob: Blob, name: string) {
  const a = document.createElement('a'); const url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
const browser = (): DeliverEnv => ({ nav: navigator, download, touch: matchMedia('(pointer: coarse)').matches });

/** Phones get the share sheet (so the page can go to Photos); everything else downloads. */
export async function deliver(blob: Blob, filename: string, env: DeliverEnv = browser()): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const files = [new File([blob], filename, { type: 'image/png' })];
  if (env.touch && env.nav.canShare?.({ files })) {
    try { await env.nav.share({ files }); return 'shared'; }
    // cancelled is a choice; anything else (often: the tap "expired" while drawing) falls back to a download
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  env.download(blob, filename);
  return 'downloaded';
}
