import { clsx } from 'clsx';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}

export function Modal({ open, onClose, title, children, footer, maxWidth = 520 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          </div>
        )}
        <div className={clsx('card-body', 'overflow-y-auto')} style={{ overflowY: 'auto' }}>
          {children}
        </div>
        {footer && (
          <div
            className="card-header"
            style={{ borderTop: '1px solid var(--border-color)', borderBottom: 'none' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
