import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  tone = 'danger',
  onConfirm,
  onCancel,
  busy = false,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[#E5E0D5] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                tone === 'danger'
                  ? 'border-[#B42318]/20 bg-[#FCECEB] text-[#B42318]'
                  : 'border-[#1D3E5E]/20 bg-[#1D3E5E]/5 text-[#1D3E5E]'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 id="confirm-dialog-title" className="font-display text-base font-semibold text-[#1C1917]">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#6B655D]">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 text-[#6B655D] transition-colors hover:bg-[#EFECE4] hover:text-[#1C1917]"
            aria-label="Tutup dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[#E5E0D5] pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="whitespace-nowrap rounded-md border border-[#E5E0D5] bg-white px-4 py-2 text-sm font-medium text-[#1C1917] transition-colors hover:bg-[#EFECE4]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 ${
              tone === 'danger'
                ? 'bg-[#B42318] hover:bg-[#911B12]'
                : 'bg-[#1D3E5E] hover:bg-[#142D46]'
            }`}
          >
            {busy ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
