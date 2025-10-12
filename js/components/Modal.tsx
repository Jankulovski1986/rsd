"use client";
import { ReactNode } from "react";

export default function Modal({ open, onClose, children }:{
  open: boolean; onClose: () => void; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop flex items-center justify-center z-50" onClick={onClose}>
      <div className="modal-panel" onClick={(e)=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
