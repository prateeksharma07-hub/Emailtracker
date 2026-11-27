import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../design/ThemeProvider';
import Stamp from '../../design/primitives/Stamp';
import { RefreshCw, Lock, ArrowRight, AlertCircle, Shield } from 'lucide-react';

/**
 * SortingEnvelope
 * 
 * Semantic, accessible interactive envelope button for "The Sorting Room".
 * - Real <button aria-label="Connect your Gmail">
 * - Hover flap lift with interior customs red glow
 * - Click/Enter/Space opens flap (180deg), letter slides up ("Connecting to Gmail..."),
 *   mini envelope particles burst, and OAuth handler fires after ~700ms.
 * - Double-click guard.
 * - Reduced-motion support: skips animation and connects immediately.
 * - Error reset with clean notification.
 */
export default function SortingEnvelope({ 
  onConnect, 
  isConnecting = false, 
  error = null, 
  onClearError 
}) {
  const { reduceMotion, theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [particles, setParticles] = useState([]);
  const hasTriggeredRef = useRef(false);

  // Generate mini envelope / parcel particles
  const spawnParticles = () => {
    if (reduceMotion) return;
    const items = [];
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
      const dist = 70 + Math.random() * 80;
      items.push({
        id: `ep_${i}_${Date.now()}`,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - 20,
        rot: Math.random() * 360,
        delay: Math.random() * 60
      });
    }
    setParticles(items);
  };

  const handleOpenAndConnect = async () => {
    if (hasTriggeredRef.current || isConnecting || isOpen) return; // Double-click guard

    if (error && onClearError) {
      onClearError();
    }

    hasTriggeredRef.current = true;

    // If user prefers reduced motion, skip delay and connect immediately
    if (reduceMotion) {
      try {
        await onConnect();
      } catch (err) {
        hasTriggeredRef.current = false;
      }
      return;
    }

    setIsOpen(true);
    spawnParticles();

    setTimeout(async () => {
      try {
        await onConnect();
      } catch (err) {
        setIsOpen(false);
        setParticles([]);
        hasTriggeredRef.current = false;
      }
    }, 700);
  };

  // Reset envelope if error occurs
  useEffect(() => {
    if (error) {
      setIsOpen(false);
      setParticles([]);
      hasTriggeredRef.current = false;
    }
  }, [error]);

  const isNight = theme === 'night' || theme === 'dark';

  return (
    <div className="w-full max-w-[460px] flex flex-col items-center">
      {/* 3D Envelope Container Button */}
      <button
        type="button"
        onClick={handleOpenAndConnect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isConnecting || hasTriggeredRef.current}
        aria-label="Connect your Gmail"
        aria-expanded={isOpen}
        tabIndex={0}
        className={`group relative w-full aspect-[16/10] cursor-pointer rounded-none border-2 border-[var(--color-ink)] transition-all duration-300 ease-out select-none focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-red)] ${
          !isOpen && !reduceMotion ? 'animate-sorting-float' : ''
        }`}
        style={{
          backgroundColor: isNight ? '#1E1916' : '#F6EEDE',
          boxShadow: isNight 
            ? '0 16px 36px -10px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(255,255,255,0.06)' 
            : '4px 4px 0px #1B1815'
        }}
      >
        {/* Interior Customs Red Heat Lamp Glow (Radiates on hover/open) */}
        <div 
          className={`absolute inset-0 transition-opacity duration-300 pointer-events-none -z-10 blur-xl ${
            isHovered || isOpen ? 'opacity-80 scale-105' : 'opacity-20 scale-95'
          }`}
          style={{
            background: 'radial-gradient(circle at 50% 40%, var(--color-red) 0%, transparent 75%)'
          }}
        />

        {/* Interior Postal Lining (Ruled / Diamond Grid) */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, var(--color-ink) 1px, transparent 1px)`,
            backgroundSize: '12px 12px'
          }}
        />

        {/* Sliding Letter (Emerged from envelope pocket) */}
        <div 
          className={`absolute left-[5%] right-[5%] top-[6%] h-[88%] p-4 flex flex-col justify-between transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] z-10 border-2 border-[var(--color-ink)] ${
            isOpen 
              ? '-translate-y-[62%] shadow-2xl' 
              : isHovered 
                ? '-translate-y-[12%] shadow-md' 
                : '-translate-y-[3%]'
          }`}
          style={{
            backgroundColor: isNight ? '#25201C' : '#FFFFFF',
            color: 'var(--color-ink)',
            boxShadow: !isNight && isOpen ? '3px 3px 0px #1B1815' : undefined
          }}
        >
          {/* Top Letter Bar */}
          <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'var(--color-line-strong)' }}>
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-red)' }}>
              ★ POSTAL DISPATCH #01
            </span>
            <span className="font-mono text-[8px] uppercase tracking-widest opacity-70">
              0% AUTO-SEND
            </span>
          </div>

          {/* Letter Body: Status */}
          <div className="text-center py-1">
            <div className="flex items-center justify-center gap-2 font-display text-sm sm:text-base font-bold">
              {isConnecting || hasTriggeredRef.current ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--color-red)' }} />
                  <span>Connecting to Gmail...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" style={{ color: 'var(--color-red)' }} />
                  <span>Open Envelope & Sign In</span>
                </>
              )}
            </div>
            <p className="font-body text-[11px] mt-1 opacity-75 max-w-[260px] mx-auto leading-tight">
              {isOpen 
                ? 'Requesting minimal read and draft permissions...'
                : 'Click or press Enter to inspect and connect.'}
            </p>
          </div>

          {/* Bottom Letter Security Tag */}
          <div className="flex items-center justify-between border-t pt-1.5 font-mono text-[8px] opacity-75" style={{ borderColor: 'var(--color-line)' }}>
            <span className="flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-emerald-500" />
              AES-256-GCM
            </span>
            <span>HUMAN APPROVAL ONLY</span>
          </div>
        </div>

        {/* Front Envelope Pocket: Left Fold */}
        <div 
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            clipPath: 'polygon(0% 0%, 0% 100%, 50% 50%)',
            backgroundColor: isNight ? '#25201C' : '#F2E7D3',
            borderLeft: '2px solid var(--color-ink)'
          }}
        />

        {/* Front Envelope Pocket: Right Fold */}
        <div 
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            clipPath: 'polygon(100% 0%, 100% 100%, 50% 50%)',
            backgroundColor: isNight ? '#25201C' : '#F2E7D3',
            borderRight: '2px solid var(--color-ink)'
          }}
        />

        {/* Front Envelope Pocket: Bottom Fold */}
        <div 
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            clipPath: 'polygon(0% 100%, 100% 100%, 50% 48%)',
            backgroundColor: isNight ? '#2E2723' : '#ECE0C9',
            borderBottom: '2px solid var(--color-ink)'
          }}
        >
          {/* Airmail Chevron Striping along bottom rim */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-2 opacity-40"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, var(--color-red), var(--color-red) 8px, transparent 8px, transparent 16px, var(--color-teal), var(--color-teal) 16px, transparent 16px, transparent 24px)`
            }}
          />
        </div>

        {/* Top Flap (Flips 180deg backward on open) */}
        <div 
          className="absolute top-0 left-0 w-full h-[54%] origin-top transition-transform duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] z-30 pointer-events-none"
          style={{
            clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
            backgroundColor: isNight ? '#362E2A' : '#E6D7BE',
            borderTop: '2px solid var(--color-ink)',
            transform: isOpen 
              ? 'rotateX(-180deg)' 
              : isHovered 
                ? 'rotateX(-32deg)' 
                : 'rotateX(0deg)',
            boxShadow: isOpen ? 'none' : '0 8px 20px rgba(0,0,0,0.3)'
          }}
        />

        {/* Postal Stamp Badge on Top Right */}
        <div className="absolute top-2.5 right-2.5 z-30 pointer-events-none">
          <div 
            className="p-1 border border-[var(--color-red)] bg-white text-slate-900 shadow-xs flex flex-col items-center justify-center font-typewriter text-[7px] leading-tight"
            style={{ width: '56px', height: '42px' }}
          >
            <span className="font-mono text-[6px] tracking-widest uppercase opacity-75">AIRMAIL</span>
            <span className="font-bold my-0.5" style={{ color: 'var(--color-red)' }}>INSPECTED</span>
            <span className="font-mono text-[5px]">MM // 2026</span>
          </div>
        </div>

        {/* Central Customs Wax / Rubber Seal */}
        <div 
          className={`absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none transition-all duration-300 ${
            isOpen ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
          }`}
        >
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center font-typewriter font-bold text-xs text-white border-2 border-[var(--color-ink)] shadow-md transition-transform duration-200"
            style={{
              backgroundColor: 'var(--color-red)',
              transform: isHovered ? 'scale(1.1) rotate(6deg)' : 'scale(1) rotate(0deg)'
            }}
          >
            <Lock className="w-4 h-4" />
          </div>
        </div>

        {/* Confetti / Envelope Burst Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute left-1/2 top-1/2 pointer-events-none z-50 w-2.5 h-2.5 border border-[var(--color-ink)]"
            style={{
              backgroundColor: Math.random() > 0.5 ? 'var(--color-red)' : 'var(--color-teal)',
              animation: 'envelope-burst 0.7s cubic-bezier(0.12, 0.8, 0.32, 1) forwards',
              animationDelay: `${p.delay}ms`,
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              '--tr': `${p.rot}deg`
            }}
          />
        ))}
      </button>

      {/* Envelope Explanatory Label */}
      <p className="mt-3 text-xs font-mono tracking-tight text-center opacity-70" style={{ color: 'var(--color-muted)' }}>
        Tap the envelope to open your inbox
      </p>

      {/* Official Sign in with Google Button Fallback (Standard Compliant Assets) */}
      <div className="mt-4 w-full flex flex-col items-center">
        <button
          type="button"
          onClick={handleOpenAndConnect}
          disabled={isConnecting || hasTriggeredRef.current}
          aria-label="Sign in with Google"
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-none font-medium text-xs sm:text-sm bg-white text-slate-800 border-2 border-[var(--color-ink)] shadow-[var(--shadow-offset)] hover:shadow-[var(--shadow-offset-hover)] hover:-translate-x-[1px] hover:-translate-y-[1px] active:shadow-[var(--shadow-offset-active)] active:translate-x-[2px] active:translate-y-[2px] cursor-pointer disabled:opacity-60 disabled:pointer-events-none transition-all duration-100 min-h-[44px]"
          style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}
        >
          {/* Official Pre-Approved Google 4-Color "G" */}
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span className="font-semibold text-slate-800">
            {isConnecting || hasTriggeredRef.current ? 'Connecting to Google...' : 'Sign in with Google'}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
        </button>
      </div>

      {/* Particle Burst Keyframe Styles */}
      <style>{`
        @keyframes envelope-burst {
          0% {
            transform: translate(0, 0) scale(0.6) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(1.1) rotate(var(--tr));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
