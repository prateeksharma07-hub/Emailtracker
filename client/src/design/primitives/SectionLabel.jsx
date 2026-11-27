import React from 'react';

/**
 * SectionLabel Primitive
 * Telegraphic section header with serial number format: "No. 01 · AI EMAIL FIREWALL"
 */
export default function SectionLabel({ 
  number = '01', 
  title = 'CUSTOMS SPECIFICATION', 
  className = '' 
}) {
  return (
    <div className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider font-semibold select-none ${className}`}>
      <span 
        className="px-2 py-0.5 rounded-none font-bold"
        style={{
          backgroundColor: 'var(--color-red)',
          color: '#FFFFFF'
        }}
      >
        NO. {number}
      </span>
      <span className="opacity-40" style={{ color: 'var(--color-ink)' }}>//</span>
      <span style={{ color: 'var(--color-muted)' }}>{title}</span>
    </div>
  );
}
