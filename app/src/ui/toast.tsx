import { useEffect, useState } from 'react';

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
  // keyed so that a second message replays the entrance animation
  return message ? <div key={message.n} className="toast" role="status">{message.text}</div> : null;
}
