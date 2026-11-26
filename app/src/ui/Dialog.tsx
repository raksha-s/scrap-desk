import { useEffect, useRef, type ReactNode } from 'react';

interface Props { open: boolean; onClose(): void; className: string; id?: string; labelledBy?: string; label?: string; children: ReactNode }

/** A modal dialog. A click on the backdrop closes it only if the press began there and it has been open a moment. */
export function Dialog({ open, onClose, className, id, labelledBy, label, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const openedAt = useRef(0);
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) { openedAt.current = performance.now(); d.showModal(); }
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} id={id} className={className} aria-labelledby={labelledBy} aria-label={label}
      onClose={() => { if (open) onClose(); }}
      onPointerDown={(e) => { downOnBackdrop.current = e.target === ref.current; }}
      onClick={(e) => {
        if (e.target === ref.current && downOnBackdrop.current && performance.now() - openedAt.current > 500) onClose();
        downOnBackdrop.current = false;
      }}>
      {open && children}
    </dialog>
  );
}
