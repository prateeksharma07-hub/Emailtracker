import React from 'react';

/**
 * Kbd Primitive
 * Tactile physical keyboard key cap.
 */
export default function Kbd({ children, className = '' }) {
  return (
    <kbd 
      className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded-xs border-2 border-[var(--color-ink)] bg-[var(--bg-surface-elevated)] text-[var(--color-ink)] shadow-[1px 1px 0px var(--color-ink)] select-none ${className}`}
    >
      {children}
    </kbd>
  );
}
