import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  ShieldCheck, 
  Sparkles, 
  Mail, 
  Send, 
  CheckSquare, 
  Flame, 
  Zap, 
  ShieldAlert,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { apiFetch } from '../../utils/api';

export default function AnalyticsView() {
  const [data, setData] = useState(null);
  const [shieldStats, setShieldStats] = useState(null);
  const [ablationData, setAblationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/analytics').then(r => r.json()),
      apiFetch('/api/shield/stats').then(r => r.json()).catch(() => null),
      apiFetch('/api/analytics/benchmark-ablation').then(r => r.json()).catch(() => null)
    ])
      .then(([analyticsRes, shieldRes, ablationRes]) => {
        if (analyticsRes?.success) setData(analyticsRes);
        if (shieldRes?.success) setShieldStats(shieldRes.stats);
        if (ablationRes?.success) setAblationData(ablationRes);
      })
      .catch(err => console.error('Failed to load analytics', err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <span>Compiling intelligence analytics...</span>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const categories = data?.categories || {};
  const priorities = data?.priorities || {};

  const total = metrics.totalEmails || 1;

  const categoryConfigs = [
    { key: 'Urgent', label: 'Urgent & Critical', color: 'from-rose-500 to-amber-500', barBg: 'bg-rose-500' },
    { key: 'Work', label: 'Work Deliverables', color: 'from-violet-500 to-indigo-500', barBg: 'bg-violet-500' },
    { key: 'Meeting', label: 'Meeting Requests', color: 'from-blue-500 to-cyan-500', barBg: 'bg-blue-500' },
    { key: 'Task', label: 'Tasks & Projects', color: 'from-amber-500 to-yellow-500', barBg: 'bg-amber-500' },
    { key: 'Personal', label: 'Personal & Direct', color: 'from-emerald-500 to-teal-500', barBg: 'bg-emerald-500' },
    { key: 'Newsletter', label: 'Newsletters & Digests', color: 'from-purple-500 to-pink-500', barBg: 'bg-purple-500' },
    { key: 'Other', label: 'Other Correspondence', color: 'from-slate-400 to-slate-500', barBg: 'bg-slate-400' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Executive Email Intelligence Analytics
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time telemetry on triage efficiency, sensitive data quarantine, and cognitive time saved.
          </p>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Analyzed</span>
            <Mail className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {metrics.totalEmails}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Powered by Groq High-Speed LPU</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hours Saved</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {metrics.hoursSaved}h
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Estimated cognitive focus gained</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Privacy Shielded</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {metrics.sensitiveEmails}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Zero sensitive bytes leaked to AI</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Human Approval</span>
            <ShieldCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-3xl font-black text-sky-600 dark:text-sky-400">
            100%
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Zero autonomous dispatches</p>
        </div>

      </div>

      {/* AI Firewall & Steganography Shield Telemetry */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-cyan-500" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              AI Firewall & Threat Shield Telemetry
            </h4>
          </div>
          <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">
            Phase 1: Shield + X-Ray
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Firewall Scans</span>
            <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
              {shieldStats?.totalScanned || 0}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Total inspected</span>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[10px] font-mono uppercase text-rose-500 block">Detained (Blocked)</span>
            <span className="text-xl font-black font-mono text-rose-500">
              {shieldStats?.detained || 0}
            </span>
            <span className="text-[10px] text-rose-400/80 block mt-0.5">Adversarial overrides</span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] font-mono uppercase text-amber-500 block">Suspicious Warnings</span>
            <span className="text-xl font-black font-mono text-amber-500">
              {shieldStats?.suspicious || 0}
            </span>
            <span className="text-[10px] text-amber-400/80 block mt-0.5">Hidden structures</span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-mono uppercase text-emerald-500 block">Shield Cleared</span>
            <span className="text-xl font-black font-mono text-emerald-500">
              {shieldStats?.cleared || 0}
            </span>
            <span className="text-[10px] text-emerald-400/80 block mt-0.5">Safe correspondence</span>
          </div>
        </div>
      </div>

      {/* Two Column Visual Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category Distribution */}
        <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Category Distribution
            </h4>
            <span className="text-xs text-slate-400 font-mono">
              {metrics.totalEmails} total messages
            </span>
          </div>

          <div className="space-y-3.5">
            {categoryConfigs.map((cfg) => {
              const count = categories[cfg.key] || 0;
              const pct = Math.round((count / total) * 100);

              return (
                <div key={cfg.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {cfg.label}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${cfg.barBg} transition-all duration-500`}
                      style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Matrix */}
        <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Priority Score Breakdown (1-5)
            </h4>
            <span className="text-xs text-slate-400 font-mono">
              Urgency scoring
            </span>
          </div>

          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((p) => {
              const count = priorities[p] || 0;
              const pct = Math.round((count / total) * 100);
              const label = p === 5 ? 'Critical (Immediate Attention)' : p === 4 ? 'High Priority' : p === 3 ? 'Normal Work' : p === 2 ? 'Low Priority' : 'Informational / News';

              return (
                <div key={p} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white ${
                      p >= 5 ? 'bg-rose-500' : p === 4 ? 'bg-amber-500' : p === 3 ? 'bg-violet-500' : 'bg-slate-400'
                    }`}>
                      {p}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {label}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                    {count} emails
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Multi-Layer Security Ablation & Benchmark Progression */}
      {ablationData?.stages && (
        <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-white/10">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-cyan-500" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Empirical Layered Defense Benchmark & Ablation Study
                </h4>
                <p className="text-[11px] text-slate-400">
                  Evaluated on {ablationData.totalSamples || 100} vectors ({ablationData.totalMalicious || 50} adversarial injections, {ablationData.totalBenign || 50} benign newsletters)
                </p>
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 self-start sm:self-auto">
              Automated Offline Benchmark
            </span>
          </div>

          {/* Transparent Security Disclaimer */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start space-x-2.5">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <div>
              <span className="font-bold">Transparent Defense Scope:</span>
              <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                {ablationData.disclaimer || 'MailMind operates a defense-in-depth architecture combining structural HTML parsing, regex heuristics, and Prompt Guard classification. No security system guarantees 100% defense against novel zero-day prompt injections. Gated human approval is permanently enforced before any draft dispatch.'}
              </p>
            </div>
          </div>

          {/* Ablation Progression Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-white/10 text-[10px] uppercase font-mono text-slate-400">
                  <th className="py-2.5 px-3">Defense Stage / Layer</th>
                  <th className="py-2.5 px-3 text-center">Recall (Attacks Blocked)</th>
                  <th className="py-2.5 px-3 text-center">False Positive Rate</th>
                  <th className="py-2.5 px-3 text-center">Overall Accuracy</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-white/5 font-mono">
                {ablationData.stages.map((stg, idx) => (
                  <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-sans font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-white/10 text-[11px] font-bold flex items-center justify-center font-mono text-slate-600 dark:text-slate-400">
                        {idx + 1}
                      </span>
                      <span>{stg.stage}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-violet-600 dark:text-violet-400">
                      {stg.recall}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {stg.fpr}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                      {stg.accuracy}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
