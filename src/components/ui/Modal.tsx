import { X } from 'lucide-react';
import type { ReactNode } from 'react';
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal__header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
      {children}
    </div>
  </div>;
}
