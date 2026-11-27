import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, Shield, ArrowRight, Lock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * GiantEnvelope
 * 
 * 100% original SVG/CSS envelope illustration & interactive hero unit.
 * Features:
 * - 3D mouse parallax tilt (pointer: fine only).
 * - Hover flap peek with palette-accent light emission.
 * - Click sequence: flap flips 180deg, letter slides upward with "Connecting to Gmail…",
 *   confetti / mini envelope burst, double-click guard, then executes onConnect after ~700ms.
 * - Official Google Sign-in button with pre-approved Google G logo and guidelines.
 * - Palette-reactive tokens (Hot Mail, Sunset Customs, Paper Rocket).
 */
export default function GiantEnvelope({ 
  onConnect, 
  isConnecting, 
  error, 
  onClearError,
  activePalette = 1 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [particles, setParticles] = useState([]);
  const [isTriggered, setIsTriggered] = useState(false);
  const envelopeRef = useRef(null);

  // Generate confetti burst particles
  const generateParticles = () => {
    const items = [];
    const count = 22;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
      const distance = 90 + Math.random() * 110;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 30; // slightly upward bias
      const rot = Math.random() * 360;
      const delay = Math.random() * 80;
      const size = Math.random() > 0.5 ? 12 : 8;
      const isEnvelope = i % 4 === 0;

      items.push({
        id: `p_${i}_${Date.now()}`,
        tx,
        ty,
        rot,
        delay,
        size,
        isEnvelope
      });
    }
    setParticles(items);
  };

  // Trigger open sequence and connect after 700ms
  const handleOpenEnvelope = () => {
    if (isTriggered || isConnecting || isOpen) return; // Double-click guard

    if (error && onClearError) {
      onClearError();
    }

    setIsTriggered(true);
    setIsOpen(true);
    generateParticles();

    // Trigger OAuth connection after animation duration (~700ms)
    setTimeout(async () => {
      try {
        await onConnect();
      } catch (err) {
        // Reset on error
        setIsOpen(false);
        setIsTriggered(false);
        setParticles([]);
      }
    }, 720);
  };

  // Reset envelope animation if connection fails or error banner appears
  useEffect(() => {
    if (error) {
      setIsOpen(false);
      setIsTriggered(false);
      setParticles([]);
    }
  }, [error]);

  // Mouse Parallax (only for pointer: fine)
  const handleMouseMove = (e) => {
    if (isOpen || !envelopeRef.current) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const rect = envelopeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -9; // Max 9 deg
    const rotateY = ((x - centerX) / centerX) * 9;

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  const isPaperRocket = activePalette === 3;

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* 3D Stage Container */}
      <div 
        className="w-full max-w-[580px] px-4 py-8 relative flex items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        {/* Floating Interactive Envelope Canvas */}
        <div
          ref={envelopeRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleMouseLeave}
          onClick={handleOpenEnvelope}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenEnvelope();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Click envelope to connect with Google"
          className={`w-full aspect-[16/10.5] relative rounded-2xl cursor-pointer transition-all duration-300 ease-out focus:outline-none focus:ring-4 focus:ring-[var(--env-accent1)]/50 ${
            !isOpen ? 'animate-envelope-float' : ''
          }`}
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${isOpen ? 'translateY(24px)' : ''}`,
            transformStyle: 'preserve-3d',
            boxShadow: isPaperRocket ? 'var(--env-hard-shadow)' : 'var(--env-shadow)'
          }}
        >
          {/* Inner Glow Backlight (radiates outward on hover) */}
          <div 
            className={`absolute inset-0 rounded-2xl blur-2xl transition-opacity duration-500 pointer-events-none -z-10 ${
              isHovered || isOpen ? 'opacity-85 scale-105' : 'opacity-25 scale-95'
            }`}
            style={{
              background: `radial-gradient(circle at 50% 40%, var(--env-accent1) 0%, var(--env-accent2) 60%, transparent 80%)`
            }}
          />

          {/* Envelope Pocket Base (Back Interior Wall) */}
          <div 
            className="absolute inset-0 rounded-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--env-surface-card)',
              border: `${isPaperRocket ? '3px' : '1px'} solid var(--env-line)`
            }}
          >
            {/* Interior Postal Lining Texture */}
            <div 
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: `radial-gradient(circle, var(--env-ink) 1px, transparent 1px)`,
                backgroundSize: '16px 16px'
              }}
            />
          </div>

          {/* Sliding Letter Sheet (Inside cavity, slides up on click) */}
          <div 
            className={`absolute left-[5%] right-[5%] top-[6%] h-[90%] rounded-xl px-6 py-5 flex flex-col justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] z-10 ${
              isOpen 
                ? '-translate-y-[62%] shadow-2xl scale-[1.02]' 
                : isHovered 
                  ? '-translate-y-[12%] shadow-md' 
                  : '-translate-y-[2%]'
            }`}
            style={{
              backgroundColor: 'var(--env-envelope-letter)',
              color: 'var(--env-envelope-letter-ink)',
              border: `${isPaperRocket ? '2px solid #14121A' : '1px solid rgba(0,0,0,0.1)'}`,
              boxShadow: isPaperRocket && isOpen ? '4px 4px 0px #14121A' : undefined
            }}
          >
            {/* Top Airmail Bar */}
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: 'var(--env-accent2)' }} />
                <span className="font-mono text-[10px] tracking-widest uppercase font-bold text-slate-600">
                  SECURE AIRMAIL • DISPATCH #01
                </span>
              </div>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-black/5 uppercase font-medium">
                0% Auto-Send
              </span>
            </div>

            {/* Letter Body: Connecting Message */}
            <div className="my-auto py-2 text-center">
              <div className="flex items-center justify-center gap-2.5 text-base sm:text-lg font-bold font-display tracking-tight">
                {isTriggered || isConnecting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--env-accent2)' }} />
                    <span>Connecting to Gmail…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" style={{ color: 'var(--env-accent1)' }} />
                    <span>Click to Open & Connect</span>
                  </>
                )}
              </div>
              <p className="font-body text-xs mt-1.5 opacity-75 max-w-sm mx-auto leading-relaxed">
                {isOpen 
                  ? 'Initiating Google OAuth 2.0 handshake with minimal required scopes.'
                  : 'Click anywhere on this envelope or use the Google button below.'}
              </p>
            </div>

            {/* Bottom Letter Info */}
            <div className="flex items-center justify-between border-t pt-2 text-[10px] font-mono opacity-65" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-600" />
                AES-256-GCM Tokens
              </span>
              <span>HUMAN-IN-THE-LOOP</span>
            </div>
          </div>

          {/* Front Pocket: Left Triangle Fold */}
          <div 
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              clipPath: 'polygon(0% 0%, 0% 100%, 50% 50%)',
              backgroundColor: 'var(--env-envelope-body)',
              borderLeft: `${isPaperRocket ? '3px' : '1px'} solid var(--env-line)`
            }}
          />

          {/* Front Pocket: Right Triangle Fold */}
          <div 
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              clipPath: 'polygon(100% 0%, 100% 100%, 50% 50%)',
              backgroundColor: 'var(--env-envelope-body)',
              borderRight: `${isPaperRocket ? '3px' : '1px'} solid var(--env-line)`
            }}
          />

          {/* Front Pocket: Bottom Fold with Shadows */}
          <div 
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              clipPath: 'polygon(0% 100%, 100% 100%, 50% 48%)',
              backgroundColor: 'var(--env-envelope-body)',
              borderBottom: `${isPaperRocket ? '3px' : '1px'} solid var(--env-line)`,
              boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            {/* Airmail Border Chevron Stripes along bottom rim */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-2.5 opacity-30"
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, var(--env-accent1), var(--env-accent1) 10px, transparent 10px, transparent 20px, var(--env-accent2) 20px, var(--env-accent2) 30px, transparent 30px, transparent 40px)`
              }}
            />
          </div>

          {/* Authentic Airmail Stamp Art (Top Right Corner) */}
          <div className="absolute top-4 right-4 z-30 pointer-events-none transform rotate-3">
            <div 
              className="p-1.5 rounded bg-white/90 shadow-md flex flex-col items-center justify-center text-slate-900 border"
              style={{
                borderColor: 'var(--env-accent1)',
                width: '74px',
                height: '56px'
              }}
            >
              <div className="w-full flex items-center justify-between font-mono text-[7px] uppercase font-bold text-slate-500">
                <span>AI</span>
                <span>2026</span>
              </div>
              <Shield className="w-5 h-5 text-emerald-600 my-0.5" />
              <span className="font-display text-[8px] font-extrabold tracking-tight uppercase leading-none">
                CUSTOMS PASS
              </span>
            </div>
          </div>

          {/* Postal Rubber Stamp Mark (Left Side) */}
          <div className="absolute bottom-4 left-6 z-30 pointer-events-none transform -rotate-12 opacity-75">
            <div 
              className="w-16 h-16 rounded-full border-2 border-dashed flex flex-col items-center justify-center font-mono text-[7px] tracking-tighter uppercase font-bold p-1 text-center"
              style={{
                borderColor: 'var(--env-accent1)',
                color: 'var(--env-accent1)'
              }}
            >
              <span>MAILMIND</span>
              <span className="text-[9px]">★ 0% ★</span>
              <span>AUTO-SEND</span>
            </div>
          </div>

          {/* Central Wax / Custom Seal (Front Joint) */}
          <div 
            className={`absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 z-30 flex items-center justify-center transition-all duration-300 pointer-events-none ${
              isOpen ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
            }`}
          >
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200"
              style={{
                backgroundColor: 'var(--env-accent2)',
                color: '#FFFFFF',
                border: isPaperRocket ? '2px solid #14121A' : '2px solid rgba(255,255,255,0.4)',
                transform: isHovered ? 'scale(1.1) rotate(6deg)' : 'scale(1) rotate(0deg)'
              }}
            >
              <Lock className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Top Flap (Lid of Envelope - 3D Opening Axis at Top) */}
          <div 
            className="absolute top-0 left-0 w-full h-[54%] origin-top transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] z-30"
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
              backgroundColor: 'var(--env-envelope-flap)',
              transformStyle: 'preserve-3d',
              transform: isOpen 
                ? 'rotateX(-180deg)' 
                : isHovered 
                  ? 'rotateX(-28deg)' 
                  : 'rotateX(0deg)',
              borderTop: `${isPaperRocket ? '3px' : '1px'} solid var(--env-line)`,
              boxShadow: isOpen ? 'none' : '0 10px 25px rgba(0,0,0,0.35)'
            }}
          >
            {/* Flap Rim Subtle Edge Glow */}
            <div 
              className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), transparent 80%)'
              }}
            />
          </div>

          {/* Particle Confetti Burst (CSS Keyframe Driven) */}
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute left-1/2 top-1/2 pointer-events-none z-50 rounded"
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.isEnvelope ? 'var(--env-accent1)' : 'var(--env-accent2)',
                boxShadow: `0 0 10px ${p.isEnvelope ? 'var(--env-accent1)' : 'var(--env-accent2)'}`,
                animation: `envelope-particle-burst 0.7s cubic-bezier(0.12, 0.8, 0.32, 1) forwards`,
                animationDelay: `${p.delay}ms`,
                '--tx': `${p.tx}px`,
                '--ty': `${p.ty}px`,
                '--tr': `${p.rot}deg`
              }}
            />
          ))}
        </div>
      </div>

      {/* Primary CTA Area: Official Sign in with Google Button */}
      <div className="mt-4 flex flex-col items-center gap-3 w-full max-w-sm px-4 z-20">
        <button
          onClick={handleOpenEnvelope}
          disabled={isConnecting || isTriggered}
          className={`w-full group relative flex items-center justify-center gap-3.5 px-6 py-4 rounded-xl font-medium text-sm transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-75 disabled:pointer-events-none ${
            isPaperRocket
              ? 'bg-white text-slate-900 border-[3px] border-[#14121A] shadow-[4px_4px_0px_#14121A] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#14121A]'
              : 'bg-white text-slate-800 shadow-xl shadow-black/25 hover:bg-slate-50 hover:shadow-2xl'
          }`}
          style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}
        >
          {/* Official Google 4-Color "G" Icon */}
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
          <span className="font-semibold text-slate-800 tracking-normal">
            {isConnecting || isTriggered ? 'Connecting to Gmail…' : 'Sign in with Google'}
          </span>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform ml-auto" />
        </button>

        <p className="text-[11px] font-mono tracking-tight text-center opacity-70" style={{ color: 'var(--env-muted)' }}>
          Click envelope or button to open & connect via OAuth 2.0
        </p>
      </div>

      {/* Inline Keyframes for Confetti Burst */}
      <style>{`
        @keyframes envelope-particle-burst {
          0% {
            transform: translate(0, 0) scale(0.6) rotate(0deg);
            opacity: 1;
          }
          70% {
            opacity: 0.9;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(1.2) rotate(var(--tr));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
