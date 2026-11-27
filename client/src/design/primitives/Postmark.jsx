import React from 'react';

/**
 * Postmark Primitive
 * Authentic circular postal cancellation mark with wavy airmail kill bars.
 */
export default function Postmark({ 
  city = 'SORTING ROOM', 
  code = 'MM-01', 
  date = 'INSPECTED', 
  rotate = -8, 
  className = '' 
}) {
  return (
    <div 
      className={`inline-flex items-center gap-3 select-none opacity-80 pointer-events-none ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        color: 'var(--color-ink)'
      }}
      aria-hidden="true"
    >
      {/* Circular cancellation mark */}
      <div 
        className="w-16 h-16 rounded-full border border-dashed flex flex-col items-center justify-center p-1 text-center font-typewriter"
        style={{ borderColor: 'var(--color-line-strong)' }}
      >
        <span className="text-[7px] font-mono tracking-widest uppercase opacity-70">
          MAILMIND
        </span>
        <span className="text-[9px] font-bold tracking-tight uppercase leading-none my-0.5" style={{ color: 'var(--color-red)' }}>
          {city}
        </span>
        <span className="text-[7px] font-mono opacity-80">
          {date} • {code}
        </span>
      </div>

      {/* 3 Wavy cancellation bars */}
      <div className="flex flex-col gap-1.5 opacity-60">
        <div className="w-12 h-[2px] bg-current rounded-full" />
        <div className="w-16 h-[2px] bg-current rounded-full" />
        <div className="w-10 h-[2px] bg-current rounded-full" />
      </div>
    </div>
  );
}
