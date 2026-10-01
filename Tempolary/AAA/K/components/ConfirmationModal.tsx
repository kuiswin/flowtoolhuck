import React, { useEffect } from 'react';
import { PillButton } from './Primitives';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<Props> = ({ 
  isOpen, 
  title, 
  message, 
  confirmLabel = "Confirm Delete", 
  onConfirm, 
  onCancel 
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div 
        className="relative w-full max-w-sm bg-[var(--editor-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-red-500">
            <span className="material-symbols-outlined text-[28px]">warning</span>
            <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          </div>
          
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {message}
          </p>
          
          <div className="flex gap-3 mt-4">
            <PillButton 
              variant="outline" 
              onClick={onCancel}
              className="flex-1 !border-[var(--border-color)] !text-[var(--text-primary)]"
            >
              Cancel
            </PillButton>
            <PillButton 
              variant="solid" 
              onClick={onConfirm}
              className="flex-1 !bg-red-500 !text-white hover:!bg-red-600"
            >
              {confirmLabel}
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  );
};