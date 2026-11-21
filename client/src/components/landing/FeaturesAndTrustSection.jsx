import React, { useState } from 'react';
import { 
  ShieldCheck, 
  MessageSquare, 
  AlertTriangle, 
  Lock, 
  Database, 
  Cpu, 
  ArrowRight,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  X
} from 'lucide-react';

export default function FeaturesAndTrustSection({ onConnect, isConnecting }) {
  const [modalContent, setModalContent] = useState(null);

  const features = [
    {
      title: 'AI Security Checkpoint & X-Ray',
      subtitle: 'Visual vs Forensic Dual-Inspection',
      icon: ShieldCheck,
      color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60',
      description: 'Contrast what you see against raw token streams. Uncovers hidden CSS font-size:0px, HTML comments, and steganographic prompt overrides before AI models ingest text.'
    },
    {
      title: 'Autopilot 3-Tone Replies',
      subtitle: 'Human-Governed Email Drafting',
      icon: MessageSquare,
      color: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
      description: 'Drafts contextual replies in Professional, Concise, or Detailed tones. Matches your tone and vocabulary while enforcing a strict zero-autonomous-send guarantee.'
    },
    {
      title: 'Regret Shield Quality Sentinel',
      subtitle: 'PII, Aadhaar & Tone Defense',
      icon: AlertTriangle,
      color: 'text-rose-400 bg-rose-950/40 border-rose-800/60',
      description: 'Pre-flight draft inspection catches valid Aadhaar numbers (Verhoeff checksum), bank accounts, unfilled placeholders (<name>, TODO), and aggressive tone before pushing to Gmail.'
    }
  ];

  const trustChips = [
    { label: 'AES-256-GCM Token Storage', desc: 'OAuth tokens encrypted locally with hardware-isolated keys' },
    { label: 'Zero Autonomous Send', desc: 'No draft is ever dispatched without your explicit approval' },
    { label: 'Local PII Stripping', desc: 'OTPs and bank details kept away from external AI inference' },
    { label: 'Minimum Scope OAuth', desc: 'Only requests send and draft access needed for triage' },
    { label: 'SQLite User Isolation', desc: 'Multi-tenant database enforcing strict cryptographic boundaries' }
  ];

  return (
    <section className="py-28 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/10">
      
      {/* 3 Core Feature Cards */}
      <div className="mb-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest block mb-2">
            THREE CORE DEFENSIVE PILLARS
          </span>
          <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
            Architecture Highlights
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="p-8 rounded-3xl bg-slate-900/60 dark:bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-xl flex flex-col justify-between space-y-6 hover:border-amber-500/40 transition-all hover:-translate-y-1"
              >
                <div className="space-y-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${f.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 uppercase font-bold block">{f.subtitle}</span>
                    <h3 className="text-lg font-bold text-white font-sans">{f.title}</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {f.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center text-xs font-mono text-amber-400 font-bold">
                  <span>Engineered with Zero Auto-Send</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trust Architecture Strip */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-slate-950 border border-white/10 backdrop-blur-xl mb-24">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight">
            Built for Privacy & Sovereignty
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 font-mono">
            Every feature is designed with clear mathematical boundaries and local execution.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trustChips.map((chip, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1 text-left">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-xs text-white font-mono">{chip.label}</span>
              </div>
              <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">
                {chip.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Final Pre-Footer Call to Action */}
      <div className="text-center py-12 px-6 rounded-3xl bg-gradient-to-tr from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 max-w-4xl mx-auto space-y-6 mb-24">
        <div className="space-y-2">
          <h3 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Reclaim Your Inbox with Zero Compromise
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            Connect your Gmail in under 60 seconds. Experience real-time firewall inspection and human-approved drafting.
          </p>
        </div>

        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-slate-900 font-bold text-base shadow-xl shadow-white/5 hover:bg-slate-100 hover:shadow-2xl hover:shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-60"
        >
          {/* Official Google "G" SVG */}
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
          <span>{isConnecting ? 'Connecting to Gmail...' : 'Connect with Google'}</span>
          <ArrowRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Comprehensive Footer */}
      <footer className="pt-12 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black">
            <Sparkles className="w-4 h-4" />
          </div>
          <span>MailMind AI • Minimum Permissions OAuth 2.0</span>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setModalContent('privacy')}
            className="hover:text-white transition-colors cursor-pointer underline"
          >
            Privacy Architecture
          </button>
          <button
            onClick={() => setModalContent('terms')}
            className="hover:text-white transition-colors cursor-pointer underline"
          >
            Terms of Use
          </button>
          <a
            href="https://github.com/prateeksharma07-hub/Emailtracker"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="text-[11px] text-slate-500 text-center md:text-right">
          * Heuristic security features are best-effort protections and should not replace human verification.
        </div>
      </footer>

      {/* Privacy / Terms Modal */}
      {modalContent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-lg w-full bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl relative text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h4 className="font-bold text-base text-white font-mono uppercase">
                {modalContent === 'privacy' ? 'Privacy Architecture Policy' : 'Terms of Service'}
              </h4>
              <button
                onClick={() => setModalContent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3 font-sans leading-relaxed max-h-80 overflow-y-auto pr-2">
              {modalContent === 'privacy' ? (
                <>
                  <p>
                    <strong>Zero External Email Retention:</strong> MailMind AI processes email headers and text streams strictly within your authenticated session.
                  </p>
                  <p>
                    <strong>AES-256-GCM Token Encryption:</strong> Google OAuth refresh tokens are encrypted at rest using AES-256-GCM authenticated cipher.
                  </p>
                  <p>
                    <strong>Local PII Redaction:</strong> Aadhaar numbers, credit card CVVs, and one-time passwords (OTPs) are checked locally and quarantined from external LLM prompt contexts.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Human Authorization Required:</strong> MailMind AI is a decision-support and drafting copilot. It never dispatches emails autonomously.
                  </p>
                  <p>
                    <strong>Best-Effort Security Guarantee:</strong> All prompt-injection and domain homoglyph classifiers operate on probabilistic heuristics and do not guarantee 100% detection.
                  </p>
                  <p>
                    <strong>User Ownership:</strong> You retain complete ownership and responsibility for all emails approved and pushed to your mailbox.
                  </p>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setModalContent(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
