import { useEffect, useRef, useState } from 'react';

type Message = { text: string; ms: number; n: number };
let n = 0;
const listeners = new Set<(m: Message) => void>();

export function toast(text: string, ms = 2800) {
  const m = { text, ms, n: ++n };
  listeners.forEach((fn) => fn(m));
}

export function Toaster() {
  const [message, setMessage] = useState<Message | null>(null);
  useEffect(() => { listeners.add(setMessage); return () => { listeners.delete(setMessage); }; }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.ms);
    return () => clearTimeout(t);
  }, [message]);
  const el = useRef<HTMLDivElement>(null);
  // as a popover it sits above open dialogs, which cover everything else
  useEffect(() => { try { el.current?.showPopover?.(); } catch { /* shown in the page instead */ } }, [message]);
  // keyed so that a second message replays the entrance animation
  return message ? <div key={message.n} ref={el} popover="manual" className="toast" role="status">{message.text}</div> : null;
}
