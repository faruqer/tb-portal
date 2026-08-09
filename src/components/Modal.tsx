'use client';

import { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Fixed height with scrollable body — footer and close stay visible. */
  fixed?: boolean;
  closeDisabled?: boolean;
}

export function Modal({ open, title, onClose, children, footer, fixed, closeDisabled }: ModalProps) {
  if (!open) return null;

  if (fixed) {
    return (
      <div className="modal-overlay" onClick={closeDisabled ? undefined : onClose}>
        <div className="modal-box modal-box-fixed" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{title}</h3>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
