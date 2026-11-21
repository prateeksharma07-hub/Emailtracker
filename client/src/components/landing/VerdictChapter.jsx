import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle2, RotateCw, Lock } from 'lucide-react';

export default function VerdictChapter() {
  const [flippedCard, setFlippedCard] = useState(null);

  const verdicts = [
    {
      id: 'cleared',
      title: 'CLEARED',
      subtitle: 'Firewall Integrity Verified',
      stampText: 'VERIFIED CLEARED',
      stampColor: 'border-emerald-500 text-emerald-400 bg-emerald-950/30',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: ShieldCheck,
      borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
      score: '0 / 100',
      threatSummary: 'Zero hidden CSS, zero instruction overrides, verified DKIM/SPF alignment.',
      actionAllowed: 'Full AI summarization, deadline extraction & draft preparation permitted.',
      policyInvariant: 'Benign correspondence proceeds to Groq LPU inference with zero delay.'
    },
    {
      id: 'suspicious',
      title: 'SUSPICIOUS',
      subtitle: 'Anomalous Structure Flagged',
      stampText: 'QUARANTINE SUSPICIOUS',
      stampColor: 'border-amber-400 text-amber-300 bg-amber-950/30',
      badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      icon: AlertTriangle,
      borderColor: 'border-amber-500/30 hover:border-amber-500/60',
      score: '45 / 100',
      threatSummary: 'Lookalike domain mimicry or anomalous base64 structure without explicit attack vector.',
      actionAllowed: 'AI stripped to visible plain-text only. Automated tool calls and external links suppressed.',
      policyInvariant: 'Sender anomaly without direct risky ask is capped at SUSPICIOUS, never auto-detained.'
    },
    {
      id: 'detained',
      title: 'DETAINED',
      subtitle: 'Blocked Adversarial Vector',
      stampText: 'BLOCKED DETAINED',
      stampColor: 'border-rose-500 text-rose-400 bg-rose-950/40',
      badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      icon: ShieldAlert,
      borderColor: 'border-rose-500/40 hover:border-rose-500/80',
      score: '96 / 100',
      threatSummary: 'Active prompt injection detected in hidden styles, comments, or payload.',
      actionAllowed: 'Total AI execution isolation. Automated reply generation silenced.',
      policyInvariant: 'Safety Invariant: Detained emails strictly block draft generation & calendar export.'
    }
  ];

  return (
    <section
      id="verdict"
      className="py-28 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/10"
    >
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold text-amber-400 uppercase tracking-widest mb-3">
          <ShieldCheck className="w-4 h-4" />
          <span>Chapter 03 // THE VERDICTS</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
          Customs Dispositions
        </h2>
        <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
          Inspired by airport border control, each email receives a definitive security disposition. 
          Hover or tap any card to inspect the underlying firewall policy invariant.
        </p>
      </div>

      {/* 3 Verdict Cards Grid with Stamp-Flip Animation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {verdicts.map((v) => {
          const Icon = v.icon;
          const isFlipped = flippedCard === v.id;

          return (
            <div
              key={v.id}
              onClick={() => setFlippedCard(isFlipped ? null : v.id)}
              className={`relative h-[420px] rounded-3xl p-6 sm:p-8 bg-slate-900/60 dark:bg-slate-900/60 border ${v.borderColor} backdrop-blur-xl shadow-xl cursor-pointer transition-all duration-300 flex flex-col justify-between group overflow-hidden select-none hover:-translate-y-1`}
            >
              {/* Top Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-white" />
                  <span className="font-mono text-xs font-bold text-white uppercase">{v.title}</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${v.badgeBg}`}>
                  {v.score}
                </span>
              </div>

              {/* Center Content: Flip State vs Normal State */}
              {!isFlipped ? (
                <div className="space-y-6 text-left my-auto">
                  {/* Airport Customs Stamp Visual Effect */}
                  <div className={`p-4 rounded-2xl border-2 border-dashed font-mono font-black text-center text-lg sm:text-xl tracking-widest uppercase transform -rotate-3 select-none shadow-md ${v.stampColor} animate-pulse`}>
                    {v.stampText}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-white font-mono">{v.subtitle}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {v.threatSummary}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-left my-auto animate-fade-in">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-amber-400">Policy Invariant:</span>
                    <p className="text-xs font-mono text-slate-200 bg-white/5 p-3 rounded-xl border border-white/10">
                      {v.policyInvariant}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Action Allowed:</span>
                    <p className="text-xs text-slate-300">
                      {v.actionAllowed}
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom Card Footer */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>{isFlipped ? 'Click to close specs' : 'Tap to inspect policy'}</span>
                <RotateCw className="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-500" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
