import React from 'react';

/**
 * Panel Primitive
 * Postal card / ledger panel with optional ruled ledger lines, hard offset shadow, and solid borders.
 */
export default function Panel({ 
  children, 
  ruled = false, 
  variant = 'default', 
  className = '', 
  style = {},
  as: Component = 'div',
  ...props 
}) {
  const variantStyles = {
    default: 'bg-[var(--bg-surface)] border-2 border-[var(--color-line-strong)] text-[var(--color-ink)] shadow-[var(--shadow-card)]',
    elevated: 'bg-[var(--bg-surface-elevated)] border-2 border-[var(--color-ink)] text-[var(--color-ink)] shadow-[var(--shadow-offset)]',
    docket: 'bg-[var(--bg-surface)] border border-dashed border-[var(--color-line-strong)] text-[var(--color-ink)]'
  };

  return (
    <Component
      className={`relative p-6 transition-colors duration-200 ${variantStyles[variant] || variantStyles.default} ${className}`}
      style={{
        ...(ruled ? {
          backgroundImage: `linear-gradient(to bottom, transparent 23px, var(--color-line) 24px)`,
          backgroundSize: '100% 24px'
        } : {}),
        ...style
      }}
      {...props}
    >
      {children}
    </Component>
  );
}
