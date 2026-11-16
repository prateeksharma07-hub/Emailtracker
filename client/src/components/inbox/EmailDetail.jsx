import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  CheckSquare, 
  Square, 
  Send, 
  Trash2, 
  Mail, 
  Calendar, 
  Flame, 
  FileEdit,
  Eye,
  CornerDownRight
} from 'lucide-react';

export default function EmailDetail({ email, onBack, onSelectDraft, onDelete, onToggleTask, onRefreshEmail }) {
  if (!email) return null;

  const [activeTab, setActiveTab] = useState('body'); // 'body' | 'raw'
  const [customPrompt, setCustomPrompt] = useState('');
  const [customTone, setCustomTone] = useState('Professional');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const [customError, setCustomError] = useState(null);

  // Priority color styling
  const getPriorityBadge = (score) => {
    if (score >= 5) {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <Flame className="w-3 h-3 text-rose-500" />
          <span>Priority 5/5 (Critical)</span>
        </span>
      );
    }
    if (score === 4) {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3 text-amber-500" />
          <span>Priority 4/5 (High)</span>
        </span>
      );
    }
    if (score === 3) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
          Priority 3/5 (Normal)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
        Priority {score}/5 (Low)
      </span>
    );
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'Urgent': return 'badge-urgent';
      case 'Work': return 'badge-work';
      case 'Meeting': return 'badge-meeting';
      case 'Task': return 'badge-task';
      case 'Personal': return 'badge-personal';
      case 'Newsletter': return 'badge-newsletter';
      default: return 'badge-other';
    }
  };

  const handleGenerateCustomReply = async (e) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;

    try {
      setIsGeneratingCustom(true);
      setCustomError(null);

      const res = await fetch('/api/ai/generate-custom-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: email.id,
          userInstruction: customPrompt,
          tone: customTone
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate custom reply');
      }

      setCustomPrompt('');
      if (onRefreshEmail) onRefreshEmail(email.id);
      if (onSelectDraft) onSelectDraft(data.draft);
    } catch (err) {
      setCustomError(err.message);
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  const formattedDate = email.date_received 
    ? new Date(email.date_received).toLocaleString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit' 
      })
    : '';

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 shadow-xl space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/10">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Messages</span>
        </button>

        <div className="flex items-center space-x-2">
          {onDelete && (
            <button
              onClick={() => onDelete(email.id)}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
              title="Delete from local database"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Email Subject & Meta */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getCategoryBadgeClass(email.category)}`}>
            {email.category}
          </span>
          {getPriorityBadge(email.priority_score)}
          {Boolean(email.is_sensitive) && (
            <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-3 h-3" />
              <span>Sensitive Shielded ({email.sensitive_type || 'PII'})</span>
            </span>
          )}
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          {email.subject}
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-white/5 p-3 rounded-2xl">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center text-xs">
              {(email.sender_name || email.sender || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white">
                {email.sender_name || email.sender}
              </span>
              <span className="text-slate-400 ml-1.5">&lt;{email.sender}&gt;</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Sensitive Protection Notice if applicable */}
      {Boolean(email.is_sensitive) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
          <div className="flex items-center space-x-2 font-bold text-amber-600 dark:text-amber-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Zero-Leak Privacy Shield Activated</span>
          </div>
          <p className="leading-relaxed">
            This email contains sensitive verification codes or financial records ({email.sensitive_type}). To protect your security, MailMind strictly blocked this email from being sent to any external AI. Local safe summary provided.
          </p>
        </div>
      )}

      {/* AI Executive Summary Card */}
      {email.summary && (
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-violet-500/10 via-pink-500/5 to-amber-500/10 border border-violet-500/20 shadow-xs">
          <div className="flex items-center space-x-2 text-violet-700 dark:text-violet-300 font-bold text-xs uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI Executive Brief</span>
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
            {email.summary}
          </p>
        </div>
      )}

      {/* Extracted Action Items & Deadlines */}
      {email.tasks && email.tasks.length > 0 && (
        <div className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <CheckSquare className="w-4 h-4 text-amber-500" />
            <span>Extracted Action Items & Deadlines ({email.tasks.length})</span>
          </div>

          <div className="space-y-2">
            {email.tasks.map((task) => (
              <div 
                key={task.id}
                onClick={() => onToggleTask && onToggleTask(task.id, !task.is_completed)}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                  task.is_completed 
                    ? 'bg-emerald-500/5 border-emerald-500/20 line-through text-slate-400' 
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-violet-500/40 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  {task.is_completed ? (
                    <CheckSquare className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <span className="font-semibold">{task.task_title}</span>
                </div>

                {task.deadline_text && (
                  <span className="flex items-center space-x-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full ml-2 flex-shrink-0">
                    <Calendar className="w-3 h-3" />
                    <span>{task.deadline_text}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Reply Suggestions Strip */}
      {!email.is_sensitive && (
        <div className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <FileEdit className="w-4 h-4 text-pink-500" />
              <span>AI Reply Suggestions (Human Review Required)</span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
              Approval Gate Active
            </span>
          </div>

          {/* Preset Draft Cards */}
          {email.drafts && email.drafts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {email.drafts.map((draft) => (
                <div 
                  key={draft.id}
                  className="rounded-xl p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-violet-500/50 flex flex-col justify-between space-y-3 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                        {draft.tone}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {draft.status === 'SENT' ? 'Sent' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-4 leading-relaxed font-sans">
                      {draft.reply_body}
                    </p>
                  </div>

                  <button
                    onClick={() => onSelectDraft && onSelectDraft(draft)}
                    className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 shadow-xs transition-all cursor-pointer"
                  >
                    <Send className="w-3 h-3 text-amber-300" />
                    <span>Review & Send</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No automated drafts created for this email.</p>
          )}

          {/* Custom Instruction Box */}
          <form onSubmit={handleGenerateCustomReply} className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-2">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
              Prompt AI for a Tailored Response:
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="e.g., Politely accept the meeting and confirm I will attend via Zoom..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <select
                value={customTone}
                onChange={(e) => setCustomTone(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="Professional">Professional</option>
                <option value="Concise">Concise</option>
                <option value="Detailed">Detailed</option>
              </select>
              <button
                type="submit"
                disabled={isGeneratingCustom || !customPrompt.trim()}
                className="btn-primary text-xs font-bold px-4 py-2 space-x-1.5 flex-shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{isGeneratingCustom ? 'Drafting...' : 'Generate Draft'}</span>
              </button>
            </div>
            {customError && (
              <p className="text-xs text-rose-500">{customError}</p>
            )}
          </form>
        </div>
      )}

      {/* Full Email Message Content */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Original Email Message
          </span>
          <div className="flex space-x-1 bg-slate-100 dark:bg-white/10 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('body')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                activeTab === 'body' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Formatted View
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                activeTab === 'raw' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Plain Text
            </button>
          </div>
        </div>

        {activeTab === 'body' ? (
          <div 
            className="prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: email.body_html || `<p>${email.body_text}</p>` }}
          />
        ) : (
          <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 p-4 rounded-xl overflow-x-auto">
            {email.body_text || email.snippet}
          </pre>
        )}
      </div>

    </div>
  );
}
