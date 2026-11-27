import React, { useEffect } from 'react';

/**
 * PaletteSwitcher
 * 
 * Provides discrete theme switching across the 3 custom palettes:
 * - 1: Hot Mail (Dark, Lime #C6FF3D, Coral #FF4D5A)
 * - 2: Sunset Customs (Dark, Amber #FFB020, Magenta #FF2E88, Teal #19E3C1)
 * - 3: Paper Rocket (Light, Tomato #FF4B2B, Mustard #FFC83D, Mint #7CF2C9)
 * 
 * Synchronizes with:
 * - URL parameter `?palette=1|2|3`
 * - Keyboard shortcut `P` (dev and power users)
 * - Document root attribute `data-envelope-palette="1|2|3"`
 */
export default function PaletteSwitcher({ activePalette, onChangePalette, onToggleTheme, currentTheme }) {
  // Keyboard shortcut listener: 'P' to cycle 1 -> 2 -> 3 -> 1
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        const next = activePalette === 3 ? 1 : activePalette + 1;
        onChangePalette(next);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePalette, onChangePalette]);

  const palettes = [
    {
      id: 1,
      name: 'Hot Mail',
      dot1: '#C6FF3D',
      dot2: '#FF4D5A',
      isLight: false
    },
    {
      id: 2,
      name: 'Sunset Customs',
      dot1: '#FFB020',
      dot2: '#FF2E88',
      isLight: false
    },
    {
      id: 3,
      name: 'Paper Rocket',
      dot1: '#FF4B2B',
      dot2: '#FFC83D',
      isLight: true
    }
  ];

  return (
    <div 
      className="inline-flex items-center gap-1 p-1 rounded-full border transition-all text-xs font-mono backdrop-blur-md"
      style={{
        backgroundColor: 'var(--env-surface)',
        borderColor: 'var(--env-line)',
        boxShadow: activePalette === 3 ? '2px 2px 0px #14121A' : '0 2px 8px rgba(0,0,0,0.2)'
      }}
      role="group"
      aria-label="Color Palette Switcher"
    >
      <span className="px-2 text-[10px] uppercase font-bold tracking-wider opacity-60 hidden sm:inline" style={{ color: 'var(--env-muted)' }}>
        Palette:
      </span>

      {palettes.map((p) => {
        const isActive = activePalette === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChangePalette(p.id)}
            title={`Switch to ${p.name} (Shortcut: P)`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer font-medium ${
              isActive 
                ? 'shadow-sm font-bold' 
                : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: isActive 
                ? (activePalette === 3 ? '#14121A' : 'rgba(255, 255, 255, 0.12)')
                : 'transparent',
              color: isActive 
                ? (activePalette === 3 ? '#FFF1D6' : 'var(--env-ink)')
                : 'var(--env-muted)',
              border: isActive && activePalette === 3 ? '1px solid #14121A' : 'none'
            }}
          >
            {/* Color Swatch Dots */}
            <span className="flex items-center -space-x-1">
              <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: p.dot1 }} />
              <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: p.dot2 }} />
            </span>
            <span className="hidden md:inline">{p.name}</span>
            <span className="md:hidden">{p.id}</span>
          </button>
        );
      })}

      <span className="px-1.5 text-[9px] font-mono opacity-40 hidden lg:inline" title="Press 'P' on keyboard to cycle palettes">
        [P]
      </span>
    </div>
  );
}
