import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import GiantEnvelope from './GiantEnvelope';
import PaletteSwitcher from './PaletteSwitcher';
import { 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  Zap, 
  CheckCircle2, 
  Sun, 
  Moon, 
  Inbox, 
  FileText, 
  AlertCircle,
  Eye,
  ShieldAlert,
  Users,
  Check,
  ChevronRight,
  ArrowRight,
  Sliders,
  Send,
  HelpCircle,
  FileCheck
} from 'lucide-react';

export default function LoginView() {
  const { connectGmail, authNotification, clearAuthNotification } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState(null);

  // Active palette: 1 = Hot Mail (Dark), 2 = Sunset Customs (Dark), 3 = Paper Rocket (Light)
  const [activePalette, setActivePalette] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = parseInt(params.get('palette'), 10);
      if ([1, 2, 3].includes(p)) return p;
      const saved = localStorage.getItem('mailmind_envelope_palette');
      if (saved && [1, 2, 3].includes(Number(saved))) return Number(saved);
    }
    return 1;
  });

  const handlePaletteChange = (newPalette) => {
    setActivePalette(newPalette);
    try {
      localStorage.setItem('mailmind_envelope_palette', newPalette.toString());
      const url = new URL(window.location.href);
      url.searchParams.set('palette', newPalette.toString());
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      // Ignore storage/history issues if sandboxed
    }
  };

  // Sync palette attribute & dark mode class on document element
  useEffect(() => {
    document.documentElement.setAttribute('data-envelope-palette', activePalette.toString());
    if (activePalette === 3) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [activePalette]);

  // Handle theme toggle button
  const handleToggleTheme = () => {
    if (activePalette === 3) {
      handlePaletteChange(1);
    } else {
      handlePaletteChange(3);
    }
    toggleTheme();
  };

  // OAuth connect handler with double-click and state guard
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setConnectError(null);
      await connectGmail();
    } catch (err) {
      setIsConnecting(false);
      setConnectError(err?.message || 'Failed to initiate Gmail connection.');
    }
  };

  const isLight = activePalette === 3;

  // Reusable card styling matching current palette
  const cardStyle = {
    backgroundColor: 'var(--env-surface)',
    borderColor: 'var(--env-line)',
    borderWidth: isLight ? '3px' : '1px',
    borderStyle: 'solid',
    boxShadow: isLight ? '4px 4px 0px #14121A' : '0 12px 36px -8px rgba(0,0,0,0.45)'
  };

  return (
    <div 
      className="min-h-screen flex flex-col justify-between selection:bg-[var(--env-accent1)] selection:text-black relative transition-colors duration-300 font-body"
      style={{
        backgroundColor: 'var(--env-bg)',
        color: 'var(--env-ink)'
      }}
    >
      {/* Background Decorative Postal Grids */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.035] -z-10"
        style={{
          backgroundImage: `radial-gradient(circle, var(--env-ink) 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Top Header Navigation */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-lg shadow-md transition-transform hover:scale-105"
            style={{
              backgroundColor: 'var(--env-accent1)',
              color: isLight ? '#14121A' : '#0D0A0B',
              border: isLight ? '2px solid #14121A' : 'none',
              boxShadow: isLight ? '2px 2px 0px #14121A' : undefined
            }}
          >
            ✉
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight font-display" style={{ color: 'var(--env-ink)' }}>
                MailMind AI
              </span>
              <span 
                className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold tracking-wider"
                style={{
                  backgroundColor: 'var(--env-surface-card)',
                  color: 'var(--env-accent1)',
                  border: `1px solid var(--env-line)`
                }}
              >
                v2.0 Multi-User
              </span>
            </div>
            <p className="text-[11px] font-mono opacity-60 hidden sm:block" style={{ color: 'var(--env-muted)' }}>
              Verified Email Intelligence & Local Firewall
            </p>
          </div>
        </div>

        {/* Right Nav: Palette Switcher + Theme Toggle */}
        <div className="flex items-center gap-3">
          <PaletteSwitcher 
            activePalette={activePalette}
            onChangePalette={handlePaletteChange}
            onToggleTheme={handleToggleTheme}
            currentTheme={theme}
          />

          <button
            onClick={handleToggleTheme}
            className="p-2 rounded-xl transition-all cursor-pointer"
            style={{
              backgroundColor: 'var(--env-surface)',
              color: 'var(--env-ink)',
              border: `${isLight ? '2px' : '1px'} solid var(--env-line)`,
              boxShadow: isLight ? '2px 2px 0px #14121A' : undefined
            }}
            title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
            aria-label="Toggle theme"
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Hero & Content Flow */}
      <main className="w-full max-w-6xl mx-auto px-6 py-8 flex flex-col items-center text-center z-10">
        
        {/* Error / Auth Notification Banner */}
        {(authNotification || connectError) && (
          <div 
            className="mb-8 w-full max-w-xl p-4 rounded-xl text-sm flex items-start gap-3 border shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
            style={{
              backgroundColor: 'var(--env-surface-card)',
              borderColor: 'var(--env-accent2)',
              color: 'var(--env-ink)',
              boxShadow: isLight ? '4px 4px 0px #14121A' : undefined
            }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--env-accent2)' }} />
            <div className="flex-1 text-left text-xs leading-relaxed font-body">
              {connectError || authNotification?.message}
            </div>
            <button 
              onClick={() => {
                setConnectError(null);
                if (clearAuthNotification) clearAuthNotification();
              }}
              className="text-xs px-2 py-0.5 rounded opacity-60 hover:opacity-100 font-mono"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hero Top Tag / Pill */}
        <div 
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-medium mb-6 backdrop-blur-sm"
          style={{
            backgroundColor: 'var(--env-surface-card)',
            color: 'var(--env-accent1)',
            border: `1px solid var(--env-line)`
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--env-accent1)' }} />
          <span>Local Security Firewall • Best-Effort AI Triage</span>
        </div>

        {/* Main Display Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl font-display leading-[1.08]">
          Your Inbox, Triaged &{' '}
          <span 
            className="relative inline-block px-1"
            style={{ 
              color: 'var(--env-accent1)',
              textDecoration: isLight ? 'underline' : 'none'
            }}
          >
            Shielded.
          </span>
          <br className="hidden sm:inline" />
          {' '}Every Reply in Your Hands.
        </h1>

        {/* Subtitle */}
        <p 
          className="mt-6 text-base sm:text-lg max-w-2xl leading-relaxed font-body"
          style={{ color: 'var(--env-muted)' }}
        >
          MailMind AI connects securely to your Gmail. It categorizes incoming mail in milliseconds, screens sensitive credentials locally before AI inference, and drafts human-approved responses. Never sends an email on its own.
        </p>

        {/* Giant Envelope Hero Interactive Unit */}
        <div className="w-full mt-6 flex justify-center">
          <GiantEnvelope 
            onConnect={handleConnect}
            isConnecting={isConnecting}
            error={connectError || (authNotification?.type === 'error' ? authNotification.message : null)}
            onClearError={() => {
              setConnectError(null);
              if (clearAuthNotification) clearAuthNotification();
            }}
            activePalette={activePalette}
          />
        </div>

        {/* Security & Architecture Trust Bar */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 opacity-85">
            <Lock className="w-3.5 h-3.5" style={{ color: 'var(--env-accent1)' }} />
            AES-256-GCM Token Encryption
          </span>
          <span className="opacity-40">•</span>
          <span className="flex items-center gap-1.5 opacity-85">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            0% Auto-Send (You Approve Every Draft)
          </span>
          <span className="opacity-40">•</span>
          <span className="flex items-center gap-1.5 opacity-85">
            <Zap className="w-3.5 h-3.5" style={{ color: 'var(--env-accent2)' }} />
            Local Credential Shield (Best-Effort)
          </span>
          <span className="opacity-40">•</span>
          <span className="flex items-center gap-1.5 opacity-85">
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--env-accent3)' }} />
            Groq LPU High-Speed Inference
          </span>
        </div>

        {/* Capability Pillars Section (4 Rich Feature Cards) */}
        <section className="mt-24 w-full text-left">
          <div className="text-center mb-12">
            <div 
              className="inline-block px-3 py-1 rounded-full text-[11px] font-mono uppercase font-bold tracking-widest mb-3"
              style={{
                backgroundColor: 'var(--env-surface-card)',
                color: 'var(--env-accent1)',
                border: '1px solid var(--env-line)'
              }}
            >
              Architecture & Features
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold font-display tracking-tight">
              Four Layers of Intelligence & Safety
            </h2>
            <p className="mt-3 text-sm max-w-xl mx-auto font-body" style={{ color: 'var(--env-muted)' }}>
              Built from day one with deterministic guards so you stay completely in control of your inbox.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            
            {/* Pillar 1: Checkpoint X-Ray */}
            <div 
              className="p-7 rounded-2xl flex flex-col justify-between transition-all duration-300 hover:translate-y-[-2px]"
              style={cardStyle}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold"
                    style={{
                      backgroundColor: 'var(--env-surface-card)',
                      color: 'var(--env-accent1)',
                      border: `1px solid var(--env-line)`
                    }}
                  >
                    <Eye className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono uppercase font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: 'var(--env-surface-card)', color: 'var(--env-muted)' }}>
                    Pillar 01
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display tracking-tight mb-2">
                  Checkpoint X-Ray Inspector
                </h3>
                <p className="text-sm font-body leading-relaxed mb-6" style={{ color: 'var(--env-muted)' }}>
                  Inspect exactly why an email was classified with deterministic urgency scoring (1–5) and extracted action items. Sensitive credentials (passwords, OTPs) are screened locally so private data stays private.
                </p>
              </div>

              {/* Sample Mini Mockup */}
              <div 
                className="p-4 rounded-xl text-xs font-mono border"
                style={{
                  backgroundColor: 'var(--env-surface-card)',
                  borderColor: 'var(--env-line)'
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--env-line)' }}>
                  <span className="font-bold opacity-80">Subject: Security Architecture Review</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: 'var(--env-accent1)', color: '#0D0A0B' }}>
                    PRIORITY 5
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] opacity-75">
                  <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sensitive Mail Shield: Clean
                  </span>
                  <span>Category: Work</span>
                </div>
              </div>
            </div>

            {/* Pillar 2: Regret Shield */}
            <div 
              className="p-7 rounded-2xl flex flex-col justify-between transition-all duration-300 hover:translate-y-[-2px]"
              style={cardStyle}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold"
                    style={{
                      backgroundColor: 'var(--env-surface-card)',
                      color: 'var(--env-accent2)',
                      border: `1px solid var(--env-line)`
                    }}
                  >
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono uppercase font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: 'var(--env-surface-card)', color: 'var(--env-muted)' }}>
                    Pillar 02
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display tracking-tight mb-2">
                  Regret Shield (Pre-Send Defense)
                </h3>
                <p className="text-sm font-body leading-relaxed mb-6" style={{ color: 'var(--env-muted)' }}>
                  Prevents costly email blunders before drafts are created. Analyzes drafts for forgotten attachments, passive-aggressive phrasing, leaked secrets, or risky impulsive replies.
                </p>
              </div>

              {/* Sample Mini Mockup */}
              <div 
                className="p-4 rounded-xl text-xs font-mono border"
                style={{
                  backgroundColor: 'var(--env-surface-card)',
                  borderColor: 'var(--env-line)'
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--env-line)' }}>
                  <span className="font-bold flex items-center gap-1.5" style={{ color: 'var(--env-accent2)' }}>
                    <AlertCircle className="w-3.5 h-3.5" /> Missing Attachment Warning
                  </span>
                  <span className="text-[10px] opacity-60">Pre-Flight Guard</span>
                </div>
                <div className="mt-2 text-[11px] opacity-75">
                  Detected "I have attached the updated contract" but no file was attached. Draft held for confirmation.
                </div>
              </div>
            </div>

            {/* Pillar 3: Sender Trust Memory */}
            <div 
              className="p-7 rounded-2xl flex flex-col justify-between transition-all duration-300 hover:translate-y-[-2px]"
              style={cardStyle}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold"
                    style={{
                      backgroundColor: 'var(--env-surface-card)',
                      color: 'var(--env-accent3)',
                      border: `1px solid var(--env-line)`
                    }}
                  >
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono uppercase font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: 'var(--env-surface-card)', color: 'var(--env-muted)' }}>
                    Pillar 03
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display tracking-tight mb-2">
                  Sender Trust Memory
                </h3>
                <p className="text-sm font-body leading-relaxed mb-6" style={{ color: 'var(--env-muted)' }}>
                  Builds deterministic trust profiles across your communication network. Colleagues with high interaction history get trusted status, while unfamiliar domains receive extra safety verification.
                </p>
              </div>

              {/* Sample Mini Mockup */}
              <div 
                className="p-4 rounded-xl text-xs font-mono border"
                style={{
                  backgroundColor: 'var(--env-surface-card)',
                  borderColor: 'var(--env-line)'
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--env-line)' }}>
                  <span className="font-bold opacity-80">Sender: alex@partner.io</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-500 bg-emerald-500/10">
                    TRUST SCORE: 94
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] opacity-75">
                  <span>Known Senders Database</span>
                  <span>28 Successful Threads</span>
                </div>
              </div>
            </div>

            {/* Pillar 4: Human-in-the-Loop Cockpit */}
            <div 
              className="p-7 rounded-2xl flex flex-col justify-between transition-all duration-300 hover:translate-y-[-2px]"
              style={cardStyle}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold"
                    style={{
                      backgroundColor: 'var(--env-surface-card)',
                      color: 'var(--env-accent1)',
                      border: `1px solid var(--env-line)`
                    }}
                  >
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono uppercase font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: 'var(--env-surface-card)', color: 'var(--env-muted)' }}>
                    Pillar 04
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display tracking-tight mb-2">
                  Human-in-the-Loop Cockpit
                </h3>
                <p className="text-sm font-body leading-relaxed mb-6" style={{ color: 'var(--env-muted)' }}>
                  You retain complete authority. AI crafts contextual reply drafts that you inspect, edit, or adjust before approving. Approved drafts are synced directly into your Gmail drafts folder.
                </p>
              </div>

              {/* Sample Mini Mockup */}
              <div 
                className="p-4 rounded-xl text-xs font-mono border"
                style={{
                  backgroundColor: 'var(--env-surface-card)',
                  borderColor: 'var(--env-line)'
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--env-line)' }}>
                  <span className="font-bold opacity-80">Draft Ready for Review</span>
                  <span className="text-[10px] font-semibold text-amber-500">Awaiting Approval</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="opacity-75">"Thanks for the update. Let's proceed with..."</span>
                  <span className="font-bold underline cursor-pointer" style={{ color: 'var(--env-accent1)' }}>
                    [Approve & Push]
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* How It Works Flow (3 Straightforward Steps) */}
        <section className="mt-24 w-full text-center">
          <div 
            className="inline-block px-3 py-1 rounded-full text-[11px] font-mono uppercase font-bold tracking-widest mb-3"
            style={{
              backgroundColor: 'var(--env-surface-card)',
              color: 'var(--env-accent1)',
              border: '1px solid var(--env-line)'
            }}
          >
            Simple Workflow
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold font-display tracking-tight mb-12">
            How MailMind AI Operates
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-2xl" style={cardStyle}>
              <div className="text-2xl font-extrabold font-mono mb-3" style={{ color: 'var(--env-accent1)' }}>
                01
              </div>
              <h4 className="font-bold text-base font-display mb-1.5">Secure OAuth 2.0</h4>
              <p className="text-xs font-body leading-relaxed" style={{ color: 'var(--env-muted)' }}>
                Sign in with Google using minimal required permissions. We request only access to read unread mail and create drafts—no calendar or contact scopes.
              </p>
            </div>

            <div className="p-6 rounded-2xl" style={cardStyle}>
              <div className="text-2xl font-extrabold font-mono mb-3" style={{ color: 'var(--env-accent2)' }}>
                02
              </div>
              <h4 className="font-bold text-base font-display mb-1.5">Triage & Local Shield</h4>
              <p className="text-xs font-body leading-relaxed" style={{ color: 'var(--env-muted)' }}>
                Incoming emails are evaluated locally. Sensitive credentials are kept away from external AI, while action items and drafts are prepared via Groq.
              </p>
            </div>

            <div className="p-6 rounded-2xl" style={cardStyle}>
              <div className="text-2xl font-extrabold font-mono mb-3" style={{ color: 'var(--env-accent3)' }}>
                03
              </div>
              <h4 className="font-bold text-base font-display mb-1.5">Review & Approve</h4>
              <p className="text-xs font-body leading-relaxed" style={{ color: 'var(--env-muted)' }}>
                Nothing leaves without you. You inspect the generated draft in your cockpit, customize if needed, and push it directly into Gmail drafts.
              </p>
            </div>
          </div>
        </section>

        {/* Clear Trust & Privacy FAQ */}
        <section className="mt-24 w-full text-left max-w-4xl">
          <div className="text-center mb-10">
            <h3 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight">
              Privacy & Trust Clarifications
            </h3>
            <p className="mt-2 text-xs font-mono" style={{ color: 'var(--env-muted)' }}>
              Deterministic transparency • Zero auto-send
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-xl" style={cardStyle}>
              <h5 className="font-bold text-sm font-display mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" style={{ color: 'var(--env-accent1)' }} />
                Does MailMind ever send emails on its own?
              </h5>
              <p className="text-xs font-body leading-relaxed pl-6" style={{ color: 'var(--env-muted)' }}>
                Never. MailMind has 0% auto-send capability. Every outgoing draft is either placed in your Gmail Drafts folder or requires your explicit review and approval in the app cockpit.
              </p>
            </div>

            <div className="p-5 rounded-xl" style={cardStyle}>
              <h5 className="font-bold text-sm font-display mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" style={{ color: 'var(--env-accent2)' }} />
                How are sensitive credentials and OTPs protected?
              </h5>
              <p className="text-xs font-body leading-relaxed pl-6" style={{ color: 'var(--env-muted)' }}>
                Sensitive mail containing passwords, OTPs, or banking tokens is kept away from the AI using best-effort local screening filters. All stored OAuth tokens are encrypted at rest with AES-256-GCM.
              </p>
            </div>

            <div className="p-5 rounded-xl" style={cardStyle}>
              <h5 className="font-bold text-sm font-display mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" style={{ color: 'var(--env-accent3)' }} />
                Can I switch themes or palettes at any time?
              </h5>
              <p className="text-xs font-body leading-relaxed pl-6" style={{ color: 'var(--env-muted)' }}>
                Yes! You can use the Palette Switcher in the top navigation, or tap the <kbd className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] border">P</kbd> key on your keyboard to instantly cycle between Hot Mail, Sunset Customs, and Paper Rocket.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer 
        className="w-full py-8 mt-20 text-center text-xs font-mono border-t z-10 transition-colors"
        style={{
          borderColor: 'var(--env-line)',
          color: 'var(--env-muted)'
        }}
      >
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold font-display text-sm" style={{ color: 'var(--env-ink)' }}>MailMind AI</span>
            <span>•</span>
            <span>Deterministic Email Firewall</span>
          </div>

          <div className="text-[11px] opacity-75">
            Minimal OAuth Scopes • Sensitive Mail Kept Away from AI (Best-Effort) • You Approve Every Draft
          </div>

          <div className="text-[10px] opacity-60">
            Press [P] to Switch Palette
          </div>
        </div>
      </footer>
    </div>
  );
}
