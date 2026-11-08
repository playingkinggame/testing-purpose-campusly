import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface Props { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }

/** Uses the browser's built-in <dialog>: focus is trapped, Esc closes, screen readers understand it. */
export function Modal({ open, title, onClose, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby="modal-title"
      className="app-modal m-auto w-[min(92vw,30rem)] rounded-[16px] border border-line bg-cream p-0 text-ink shadow-2xl backdrop:bg-forest-900/40"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="modal-title" className="text-lg font-semibold text-forest">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-mint">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{open && children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean; title: string; text: string; confirmLabel?: string; danger?: boolean;
  loading?: boolean; onConfirm: () => void; onClose: () => void;
}
export function ConfirmDialog({ open, title, text, confirmLabel = 'Confirm', danger, loading, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal
      open={open} title={title} onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>}
    >
      <p className="text-sm text-muted">{text}</p>
    </Modal>
  );
}
