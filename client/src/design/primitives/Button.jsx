import React from 'react';

/**
 * Button Primitive
 * Tactile postal mechanical button with hard offset shadow and active press-down translation.
 * 
 * Variants:
 * - 'primary': Customs red with dark ink border and hard shadow.
 * - 'secondary': Surface background with dark border and offset shadow.
 * - 'ghost': Borderless button with hover outline.
 */
export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  disabled = false, 
  className = '', 
  type = 'button',
  icon: Icon,
  ...props 
}) {
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base font-semibold'
  };

  const variantStyles = {
    primary: `
      bg-[var(--color-red)] text-white border-2 border-[var(--color-ink)]
      shadow-[var(--shadow-offset)]
      hover:shadow-[var(--shadow-offset-hover)] hover:-translate-x-[1px] hover:-translate-y-[1px]
      active:shadow-[var(--shadow-offset-active)] active:translate-x-[2px] active:translate-y-[2px]
    `,
    secondary: `
      bg-[var(--bg-surface)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]
      shadow-[var(--shadow-offset)]
      hover:shadow-[var(--shadow-offset-hover)] hover:-translate-x-[1px] hover:-translate-y-[1px]
      active:shadow-[var(--shadow-offset-active)] active:translate-x-[2px] active:translate-y-[2px]
    `,
    ghost: `
      bg-transparent text-[var(--color-ink)] border border-transparent
      hover:border-[var(--color-line-strong)] hover:bg-[var(--bg-surface)]
      active:translate-y-[1px]
    `,
    teal: `
      bg-[var(--color-teal)] text-white border-2 border-[var(--color-ink)]
      shadow-[var(--shadow-offset)]
      hover:shadow-[var(--shadow-offset-hover)] hover:-translate-x-[1px] hover:-translate-y-[1px]
      active:shadow-[var(--shadow-offset-active)] active:translate-x-[2px] active:translate-y-[2px]
    `
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-body font-medium select-none
        rounded-none transition-all duration-100 ease-out cursor-pointer
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red)]
        disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none
        min-h-[44px]
        ${sizeStyles[size] || sizeStyles.md}
        ${variantStyles[variant] || variantStyles.primary}
        ${className}
      `}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span>{children}</span>
    </button>
  );
}
