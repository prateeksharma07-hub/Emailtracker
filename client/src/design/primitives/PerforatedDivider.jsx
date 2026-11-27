import React from 'react';

/**
 * PerforatedDivider Primitive
 * Tactile postal tear-off perforation line.
 */
export default function PerforatedDivider({ className = '' }) {
  return (
    <div 
      className={`relative w-full my-6 flex items-center justify-center select-none ${className}`}
      aria-hidden="true"
    >
      <div 
        className="w-full border-t-2 border-dashed opacity-40"
        style={{ borderColor: 'var(--color-line-strong)' }}
      />
      <div 
        className="absolute px-3 font-mono text-[9px] uppercase tracking-widest opacity-60"
        style={{ 
          backgroundColor: 'var(--bg-canvas)', 
          color: 'var(--color-muted)' 
        }}
      >
        ✂ TEAR ALONG PERFORATION ✂
      </div>
    </div>
  );
}
