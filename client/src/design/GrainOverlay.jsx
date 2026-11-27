import React from 'react';

/**
 * GrainOverlay
 * Subtle tactile paper grain / analog film noise texture.
 * Implemented with inline SVG feTurbulence, ~4-5% opacity, pointer-events none.
 */
export default function GrainOverlay() {
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-50 select-none overflow-hidden opacity-[0.045] mix-blend-overlay"
      aria-hidden="true"
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="sorting-grain-noise">
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="0.75" 
            numOctaves="3" 
            stitchTiles="stitch" 
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#sorting-grain-noise)" />
      </svg>
    </div>
  );
}
