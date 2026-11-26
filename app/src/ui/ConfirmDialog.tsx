import { useId } from 'react';
import { Dialog } from './Dialog';

interface Props { open: boolean; title: string; body: string; onConfirm(): void; onCancel(): void }

export function ConfirmDialog({ open, title, body, onConfirm, onCancel }: Props) {
  const id = useId();
  return (
    <Dialog open={open} onClose={onCancel} className="dlg dlg-confirm" labelledBy={id}>
      <header className="dlg-head"><h2 id={id}>{title}</h2></header>
      <p>{body}</p>
      <div className="confirm-row">
        <button type="button" className="key key-sm" autoFocus onClick={onCancel}><span>Cancel</span></button>
        <button type="button" className="key key-sm" onClick={onConfirm}><span>Delete</span></button>
      </div>
    </Dialog>
  );
}
