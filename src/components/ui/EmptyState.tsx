import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'px-4 py-8' : 'px-6 py-14'
      }`}
    >
      {/* Minimalist Egyptian-Japanese geometric sanctuary emblem */}
      <svg
        viewBox="0 0 64 48"
        className="mb-4 h-11 w-14 text-[#B68D40]"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 22L32 6L56 22"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <line x1="14" y1="22" x2="14" y2="42" stroke="#D4CEC0" strokeWidth="1.5" />
        <line x1="50" y1="22" x2="50" y2="42" stroke="#D4CEC0" strokeWidth="1.5" />
        <line x1="8" y1="42" x2="56" y2="42" stroke="#1D3E5E" strokeWidth="1.5" />
        <line x1="25" y1="26" x2="25" y2="38" stroke="#D4CEC0" strokeWidth="1.5" />
        <line x1="32" y1="22" x2="32" y2="38" stroke="currentColor" strokeWidth="1.5" />
        <line x1="39" y1="26" x2="39" y2="38" stroke="#D4CEC0" strokeWidth="1.5" />
      </svg>

      <h3 className="font-display text-base font-semibold text-[#1C1917]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#6B655D]">{description}</p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 whitespace-nowrap rounded-md bg-[#1D3E5E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#142D46]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
