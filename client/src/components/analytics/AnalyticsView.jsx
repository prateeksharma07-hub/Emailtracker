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
  ShieldAlert 
} from 'lucide-react';

export default function AnalyticsView() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setData(res);
        }
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
          <p className="text-[11px] text-slate-400 mt-1">Processed with Gemini Flash</p>
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

    </div>
  );
}
