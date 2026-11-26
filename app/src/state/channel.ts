/** Tells the other open tabs that something was saved. Never delivers to the sender. */
export interface Channel { post(): void; listen(fn: () => void): void; close?(): void }

export function tabChannel(name = 'scrap-desk'): Channel | undefined {
  if (typeof BroadcastChannel === 'undefined') return undefined;
  const c = new BroadcastChannel(name);
  return { post: () => c.postMessage('changed'), listen: (fn) => { c.onmessage = () => fn(); }, close: () => c.close() };
}
