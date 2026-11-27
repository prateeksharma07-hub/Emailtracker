import React from 'react';

/**
 * Stamp Primitive
 * Authentic postal rubber stamp with double border, distressed ink styling,
 * slight rotation (-6deg to +8deg), and typewriter typography (Special Elite).
 * 
 * Variants:
 * - 'CLEARED': Green customs pass mark
 * - 'SUSPICIOUS': Amber customs warning hold
 * - 'DETAINED': Red customs quarantine block
 * - 'APPROVED': Teal/Ink approval seal
 */
export default function Stamp({ 
  variant = 'CLEARED', 
  label, 
  sublabel, 
  rotate = -3, 
  size = 'md',
  className = '' 
}) {
  const configs = {
    CLEARED: {
      text: label || 'CLEARED',
      sub: sublabel || 'POSTAL CUSTOMS PASS',
      color: 'var(--status-cleared)',
      bg: 'var(--status-cleared-surface)',
      border: 'var(--status-cleared)'
    },
    SUSPICIOUS: {
      text: label || 'SUSPICIOUS',
      sub: sublabel || 'HELD FOR INSPECTION',
      color: 'var(--status-suspicious)',
      bg: 'var(--status-suspicious-surface)',
      border: 'var(--status-suspicious)'
    },
    DETAINED: {
      text: label || 'DETAINED',
      sub: sublabel || 'QUARANTINE / DO NOT OPEN',
      color: 'var(--status-detained)',
      bg: 'var(--status-detained-surface)',
      border: 'var(--status-detained)'
    },
    APPROVED: {
      text: label || 'APPROVED',
      sub: sublabel || 'VALIDATED FOR DISPATCH',
      color: 'var(--color-teal)',
      bg: 'var(--color-teal-surface)',
      border: 'var(--color-teal)'
    }
  };

  const config = configs[variant] || configs.CLEARED;

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <div 
      className={`inline-flex flex-col items-center justify-center font-typewriter uppercase tracking-wider select-none border-2 border-dashed rounded-xs shadow-xs transition-transform duration-150 ${sizeStyles[size]} ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        color: config.color,
        borderColor: config.border,
        backgroundColor: config.bg,
        boxShadow: `inset 0 0 0 1px ${config.border}`
      }}
      role="status"
      aria-label={`Status: ${config.text}`}
    >
      <div className="flex items-center gap-1 font-bold leading-tight">
        <span>★</span>
        <span className="tracking-widest">{config.text}</span>
        <span>★</span>
      </div>
      {config.sub && (
        <span className="text-[9px] font-mono tracking-tighter opacity-80 mt-0.5">
          {config.sub}
        </span>
      )}
    </div>
  );
}
