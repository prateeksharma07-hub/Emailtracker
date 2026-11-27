import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../design/ThemeProvider';
import SortingEnvelope from './SortingEnvelope';
import CheckpointLoopTile from './CheckpointLoopTile';
import Stamp from '../../design/primitives/Stamp';
import Postmark from '../../design/primitives/Postmark';
import Button from '../../design/primitives/Button';
import Panel from '../../design/primitives/Panel';
import SectionLabel from '../../design/primitives/SectionLabel';
import PerforatedDivider from '../../design/primitives/PerforatedDivider';
import { 
  ShieldCheck, 
  Lock, 
  Zap, 
  Sun, 
  Moon, 
  Inbox, 
  FileText, 
  AlertCircle,
  Eye,
  ShieldAlert,
  Users,
  CheckCircle2,
  Calendar,
  Mic,
  ArrowRight,
  Sliders,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

export default function LoginView() {
  const { connectGmail, authNotification, clearAuthNotification } = useAuth();
  const { theme, toggleTheme, reduceMotion, toggleReduceMotion } = useTheme();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState(null);

  // Exact OAuth handshake handler preserved from AuthContext
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

  const isNight = theme === 'night' || theme === 'dark';

  return (
    <div 
      className="min-h-[100dvh] flex flex-col justify-between selection:bg-[var(--color-red)] selection:text-white font-body relative overflow-x-hidden transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--color-ink)'
      }}
    >
      {/* =========================================================================
          HERO & ABOVE-THE-FOLD CONTAINER (Fits 1440x900, 1366x768, 390x844 in 100dvh)
          ========================================================================= */}
      <div className="w-full flex flex-col justify-between min-h-[100dvh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5">
        
        {/* Top Header Navigation */}
        <header className="w-full flex items-center justify-between pb-3 border-b-2 border-dashed border-[var(--color-line-strong)] z-20">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center font-typewriter font-bold text-sm select-none border-2 border-[var(--color-ink)]"
              style={{
                backgroundColor: 'var(--color-red)',
                color: '#FFFFFF'
              }}
            >
              ✉
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-extrabold tracking-tight font-display uppercase">
                  MAILMIND // SORTING ROOM
                </span>
                <span className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 border border-current opacity-70">
                  DISPATCH BUREAU
                </span>
              </div>
              <p className="text-[10px] font-mono opacity-60 hidden md:block" style={{ color: 'var(--color-muted)' }}>
                Deterministic AI Email Firewall & Quarantine
              </p>
            </div>
          </div>

          {/* Right Header Controls: Dev Route + Theme + Reduce Motion */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dev route link to /design */}
            <a
              href="#design"
              onClick={(e) => {
                e.preventDefault();
                window.location.hash = '#design';
              }}
              className="text-[11px] font-mono font-semibold px-2 py-1 border border-[var(--color-line-strong)] hover:border-[var(--color-ink)] transition-colors hidden sm:inline"
              title="Inspect Design System components"
            >
              /design
            </a>

            {/* Reduce Motion Toggle */}
            <button
              type="button"
              onClick={toggleReduceMotion}
              className="p-1.5 sm:px-2.5 sm:py-1.5 border-2 border-[var(--color-ink)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] cursor-pointer text-xs font-mono flex items-center gap-1.5 shadow-[var(--shadow-offset)] active:translate-x-[1px] active:translate-y-[1px] transition-all min-h-[44px]"
              title={`Reduce Motion: ${reduceMotion ? 'Enabled' : 'Disabled'}`}
              aria-label="Toggle reduce motion mode"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-bold">
                Motion: {reduceMotion ? 'OFF' : 'ON'}
              </span>
            </button>

            {/* Night / Day Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 sm:px-2.5 sm:py-1.5 border-2 border-[var(--color-ink)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] cursor-pointer text-xs font-mono flex items-center gap-1.5 shadow-[var(--shadow-offset)] active:translate-x-[1px] active:translate-y-[1px] transition-all min-h-[44px]"
              title={`Switch to ${isNight ? 'Day Post Office' : 'Night Sorting Room'}`}
              aria-label="Toggle Night/Day theme"
            >
              {isNight ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden md:inline font-bold">
                {isNight ? 'Day' : 'Night'}
              </span>
            </button>
          </div>
        </header>

        {/* Auth Notification or Connect Error Alert */}
        {(authNotification || connectError) && (
          <div 
            className="w-full my-2 p-3 border-2 border-[var(--color-red)] bg-[var(--color-red-surface)] text-xs font-mono flex items-start gap-2 shadow-sm animate-in fade-in"
            style={{ color: 'var(--color-red)' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-body text-xs">
              {connectError || authNotification?.message}
            </div>
            <button
              onClick={() => {
                setConnectError(null);
                if (clearAuthNotification) clearAuthNotification();
              }}
              className="text-xs px-2 py-0.5 border border-current font-mono hover:opacity-100 opacity-60"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Hero Area: ASYMMETRIC 2-COLUMN LAYOUT (Not a centered stack!) */}
        <div className="my-auto py-2 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          
          {/* Left Column: Asymmetric Typography & Copy (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            
            <SectionLabel 
              number="01" 
              title="AI EMAIL FIREWALL" 
              className="mb-3 sm:mb-4"
            />

            {/* Headline: clamp(1.9rem, 3.4vw, 3.25rem), text-wrap balance, 1 line on desktop, max 2 on mobile */}
            <h1 
              className="font-extrabold font-display tracking-tight text-[var(--color-ink)] leading-[1.08] text-balance"
              style={{
                fontSize: 'clamp(1.9rem, 3.4vw, 3.25rem)'
              }}
            >
              Open the envelope. Keep the AI safe.
            </h1>

            {/* Subtitle: max 2 lines (~55ch) */}
            <p 
              className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed font-body max-w-[55ch]"
              style={{ color: 'var(--color-muted)' }}
            >
              MailMind scans every email for hidden instructions before an AI reads it, prepares your replies in three tones, and never sends anything without your approval.
            </p>

            {/* Quick Postal Badge / Dispatch Metadata */}
            <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-3">
              <Stamp variant="CLEARED" label="CUSTOMS PASS" sublabel="ZERO LEAK DETECTED" rotate={-2} size="sm" />
              <div className="text-[11px] font-mono opacity-70 flex items-center gap-1.5" style={{ color: 'var(--color-muted)' }}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Quarantine Station Active</span>
              </div>
            </div>
          </div>

          {/* Right Column: Giant Interactive Envelope Button (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <SortingEnvelope 
              onConnect={handleConnect}
              isConnecting={isConnecting}
              error={connectError || (authNotification?.type === 'error' ? authNotification.message : null)}
              onClearError={() => {
                setConnectError(null);
                if (clearAuthNotification) clearAuthNotification();
              }}
            />
          </div>
        </div>

        {/* Above-the-Fold Bottom Row: Benefit-First Trust Row */}
        <div className="w-full pt-3 pb-1 border-t-2 border-dashed border-[var(--color-line-strong)] z-10">
          <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 bg-[var(--color-red)] rounded-full" />
              Never sends on its own
            </span>
            <span className="opacity-40 hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 bg-[var(--status-cleared)] rounded-full" />
              You approve every draft
            </span>
            <span className="opacity-40 hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5 opacity-85">
              <Lock className="w-3.5 h-3.5" style={{ color: 'var(--color-red)' }} />
              Tokens encrypted at rest
            </span>
            <span className="opacity-40 hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5 opacity-85">
              <Zap className="w-3.5 h-3.5" style={{ color: 'var(--color-teal)' }} />
              Powered by Groq
            </span>
          </div>
        </div>

      </div>

      {/* =========================================================================
          BELOW-THE-FOLD: BENTO GRID (Self-Running Autonomous Loops)
          ========================================================================= */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        
        {/* Bento Header */}
        <div className="text-left mb-10">
          <SectionLabel number="02" title="POSTAL INSPECTION COCKPIT" />
          <h2 className="text-2xl sm:text-4xl font-extrabold font-display tracking-tight mt-3">
            Every Incoming Letter Inspected. Nothing Sent in the Dark.
          </h2>
          <p className="mt-2 text-sm max-w-2xl font-body" style={{ color: 'var(--color-muted)' }}>
            Plainspoken protections that guard your email without jargon. Watch each protocol run below.
          </p>
        </div>

        {/* Bento Grid Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Tile 1: Big Checkpoint Loop (Spans 2 columns on lg) */}
          <div className="md:col-span-2 lg:col-span-2">
            <CheckpointLoopTile />
          </div>

          {/* Tile 2: Autopilot Replies */}
          <Panel className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[var(--bg-canvas)] border border-[var(--color-line-strong)]">
                  PROTOCOL 02
                </span>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  3-TONE DRAFTING
                </span>
              </div>
              <h3 className="text-xl font-bold font-display mb-2">Autopilot Replies</h3>
              <p className="text-xs sm:text-sm font-body leading-relaxed opacity-80" style={{ color: 'var(--color-muted)' }}>
                Prof. asks you to confirm Thursday. You get 3 replies; nothing is sent until you click Approve.
              </p>
            </div>

            {/* Concrete Sample Card */}
            <div className="mt-6 p-3 border-2 border-[var(--color-line-strong)] bg-[var(--bg-canvas)] text-xs font-body">
              <div className="font-mono text-[10px] font-bold text-amber-500 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> AWAITING YOUR APPROVAL
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="p-1.5 border border-[var(--color-line)] bg-[var(--bg-surface)]">
                  <span className="font-mono font-bold text-[9px] uppercase">1. Professional: </span>
                  "I confirm my availability for Thursday at 3 PM."
                </div>
                <div className="p-1.5 border border-[var(--color-line)] bg-[var(--bg-surface)]">
                  <span className="font-mono font-bold text-[9px] uppercase">2. Concise: </span>
                  "Confirmed for Thursday 3 PM."
                </div>
              </div>
            </div>
          </Panel>

          {/* Tile 3: Regret Shield */}
          <Panel className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[var(--bg-canvas)] border border-[var(--color-line-strong)]">
                  PROTOCOL 03
                </span>
                <span className="font-mono text-[10px] text-rose-500 font-semibold">
                  PRE-FLIGHT DEFENSE
                </span>
              </div>
              <h3 className="text-xl font-bold font-display mb-2">Regret Shield</h3>
              <p className="text-xs sm:text-sm font-body leading-relaxed opacity-80" style={{ color: 'var(--color-muted)' }}>
                Draft says "please find attached" but no file is attached: you get a reminder before it leaves.
              </p>
            </div>

            {/* Concrete Sample Card */}
            <div className="mt-6 p-3 border-2 border-[var(--color-red)] bg-[var(--color-red-surface)] text-xs font-mono" style={{ color: 'var(--color-red)' }}>
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-3.5 h-3.5" /> MISSING ATTACHMENT HOLD
              </div>
              <p className="text-[11px] font-body opacity-90 leading-tight">
                Held draft because "attached" was mentioned with 0 attachments found.
              </p>
            </div>
          </Panel>

          {/* Tile 4: Sender Trust */}
          <Panel className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[var(--bg-canvas)] border border-[var(--color-line-strong)]">
                  PROTOCOL 04
                </span>
                <span className="font-mono text-[10px] text-amber-500 font-semibold">
                  LOOK-ALIKE GUARD
                </span>
              </div>
              <h3 className="text-xl font-bold font-display mb-2">Sender Trust</h3>
              <p className="text-xs sm:text-sm font-body leading-relaxed opacity-80" style={{ color: 'var(--color-muted)' }}>
                A mail from paypa1.com pretends to be PayPal: flagged as a look-alike spoof before you reply.
              </p>
            </div>

            {/* Concrete Sample Card */}
            <div className="mt-6 p-3 border-2 border-[var(--color-line-strong)] bg-[var(--bg-canvas)] text-xs font-mono">
              <div className="flex items-center justify-between pb-1 border-b border-[var(--color-line)] text-[10px]">
                <span className="text-rose-500 font-bold">DOMAIN: paypa1.com</span>
                <span className="text-[9px] px-1 bg-rose-500/10 text-rose-500">HOMOGLYPH</span>
              </div>
              <p className="mt-2 text-[11px] font-body opacity-80 leading-tight">
                Does not match verified paypal.com records. Triage score escalated to Suspicious.
              </p>
            </div>
          </Panel>

          {/* Tile 5: Voice Commands */}
          <Panel className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[var(--bg-canvas)] border border-[var(--color-line-strong)]">
                  PROTOCOL 05
                </span>
                <span className="font-mono text-[10px] text-teal-500 font-semibold">
                  VOICE DISPATCH
                </span>
              </div>
              <h3 className="text-xl font-bold font-display mb-2">Voice Commands</h3>
              <p className="text-xs sm:text-sm font-body leading-relaxed opacity-80" style={{ color: 'var(--color-muted)' }}>
                Say "Prof. Sharma ko Thursday confirm kar do": a draft appears, it never approves itself.
              </p>
            </div>

            {/* Concrete Sample Card */}
            <div className="mt-6 p-3 border-2 border-[var(--color-line-strong)] bg-[var(--bg-canvas)] text-xs font-mono">
              <div className="flex items-center gap-2 mb-1.5 text-[11px] font-bold" style={{ color: 'var(--color-teal)' }}>
                <Mic className="w-3.5 h-3.5 animate-pulse" />
                <span>TRANSCRIPT PARSED</span>
              </div>
              <p className="text-[11px] font-body opacity-80 italic">
                "Draft prepared for Prof. Sharma. Waiting for your manual review."
              </p>
            </div>
          </Panel>

          {/* Tile 6: Deadlines to Calendar */}
          <Panel className="md:col-span-2 lg:col-span-3 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[var(--bg-canvas)] border border-[var(--color-line-strong)]">
                  PROTOCOL 06
                </span>
                <span className="font-mono text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                  ICS CALENDAR FILE EXPORT
                </span>
              </div>
              <h3 className="text-xl font-bold font-display mb-1.5">Deadlines to Calendar</h3>
              <p className="text-xs sm:text-sm font-body leading-relaxed opacity-80" style={{ color: 'var(--color-muted)' }}>
                "Submit by Friday 5 PM" becomes a calendar file; always double-check the date before importing.
              </p>
            </div>

            <div className="shrink-0 p-3 border-2 border-[var(--color-line-strong)] bg-[var(--bg-canvas)] flex items-center gap-3 font-mono text-xs">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <div>
                <span className="font-bold block">Friday, 5:00 PM</span>
                <span className="text-[10px] opacity-60">Exportable as .ics file</span>
              </div>
            </div>
          </Panel>

        </div>
      </div>

      {/* =========================================================================
          FOOTER
          ========================================================================= */}
      <footer className="w-full border-t-2 border-dashed border-[var(--color-line-strong)] py-8 font-mono text-xs opacity-75">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold font-display text-sm">MAILMIND AI</span>
            <span>//</span>
            <span>THE SORTING ROOM</span>
            <span>•</span>
            <span className="opacity-75">A student project</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <a href="#privacy" className="hover:underline">Privacy Notice</a>
            <span>•</span>
            <a href="#terms" className="hover:underline">Terms of Service</a>
            <span>•</span>
            <a href="#design" onClick={(e) => { e.preventDefault(); window.location.hash = '#design'; }} className="hover:underline font-bold text-[var(--color-red)]">
              Design Catalog [/design]
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
