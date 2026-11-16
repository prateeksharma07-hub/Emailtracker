import React from 'react';
import { Sparkles, Flame, CheckSquare, ShieldCheck, ArrowRight, Zap, Send } from 'lucide-react';

export default function AiExecutiveBriefing({ 
  emails = [], 
  tasksCount = 0, 
  draftsCount = 0,
  onFilterUrgent,
  onGoToTasks,
  onGoToDrafts
}) {
  const urgentEmails = emails.filter(e => e.priority_score >= 4 || e.category === 'Urgent');
  const sensitiveEmails = emails.filter(e => e.is_sensitive);

  return (
    <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-violet-900/10 via-purple-900/5 to-amber-900/10 dark:from-violet-950/40 dark:via-purple-950/20 dark:to-amber-950/20 border border-violet-500/20 dark:border-violet-500/30 shadow-lg shadow-violet-500/5 mb-6 backdrop-blur-md">
      {/* Background ambient decorative orb */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-violet-500/15 dark:bg-violet-500/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Intelligence Summary */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-violet-600/15 text-violet-700 dark:text-violet-300 border border-violet-500/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
              <span>MailMind Intelligence Briefing</span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Live Real-Time Triage
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
            {urgentEmails.length > 0 ? (
              <>
                <span className="text-rose-500 dark:text-rose-400 font-extrabold">{urgentEmails.length} high-priority {urgentEmails.length === 1 ? 'message requires' : 'messages require'} attention</span>, with {tasksCount} extracted action items.
              </>
            ) : (
              <>
                All caught up! Inbox is clean and categorized with {tasksCount} actionable items.
              </>
            )}
          </h3>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            AI has categorized your messages, shielded sensitive financial credentials locally, and prepared contextual reply suggestions ready for one-click human approval.
          </p>
        </div>

        {/* Right: Quick Action Chips */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {urgentEmails.length > 0 && (
            <button
              onClick={onFilterUrgent}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer shadow-xs"
            >
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>Review Urgent ({urgentEmails.length})</span>
            </button>
          )}

          <button
            onClick={onGoToDrafts}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-violet-700 dark:text-violet-300 bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/30 transition-all cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5 text-violet-500" />
            <span>AI Drafts ({draftsCount})</span>
          </button>

          <button
            onClick={onGoToTasks}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs"
          >
            <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
            <span>Deadlines ({tasksCount})</span>
          </button>
        </div>

      </div>

      {/* Mini metric pills */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-200/50 dark:border-white/5 text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
          <span className="text-slate-500 dark:text-slate-400">Total Analyzed:</span>
          <strong className="text-slate-900 dark:text-white font-mono">{emails.length}</strong>
        </div>

        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-slate-500 dark:text-slate-400">Critical Priority:</span>
          <strong className="text-slate-900 dark:text-white font-mono">{urgentEmails.length}</strong>
        </div>

        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-slate-500 dark:text-slate-400">Action Items:</span>
          <strong className="text-slate-900 dark:text-white font-mono">{tasksCount}</strong>
        </div>

        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-500 dark:text-slate-400">Protected Shield:</span>
          <strong className="text-slate-900 dark:text-white font-mono">{sensitiveEmails.length} safe</strong>
        </div>
      </div>
    </div>
  );
}
