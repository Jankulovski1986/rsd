"use client";
import { ReactNode } from "react";

export default function Modal({ open, onClose, children, panelClassName }:{
  open: boolean; onClose: () => void; children: ReactNode; panelClassName?: string;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop flex items-center justify-center z-50" onClick={onClose}>
      <div className={`modal-panel ${panelClassName ?? ""}`} onClick={(e)=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
