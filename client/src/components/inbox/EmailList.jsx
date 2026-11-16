import React from 'react';
import { 
  Flame, 
  Clock, 
  ShieldAlert, 
  Sparkles, 
  CheckSquare, 
  Send, 
  Mail, 
  Inbox, 
  Search,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function EmailList({ 
  emails = [], 
  selectedEmailId, 
  onSelectEmail, 
  searchQuery, 
  setSearchQuery, 
  priorityFilter, 
  setPriorityFilter,
  isLoading,
  pagination = { page: 1, limit: 20, total: 0, totalPages: 1 },
  onPageChange
}) {

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

  const formatEmailTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.round((now - date) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const startCount = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endCount = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-4">
      
      {/* Search & Priority Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search emails by sender, subject, or AI summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-[#0D0E14] border border-slate-200/80 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#0D0E14] border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none shadow-xs"
          >
            <option value="">All Priorities</option>
            <option value="5">Critical (5/5)</option>
            <option value="4">High Priority (4+/5)</option>
            <option value="3">Normal (3+/5)</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Synchronizing and categorizing messages...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && emails.length === 0 && (
        <div className="glass-card rounded-3xl p-12 text-center border border-slate-200/80 dark:border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            No matching emails found
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query, or click "Sync Now" to fetch live emails from Gmail.
          </p>
        </div>
      )}

      {/* Email Feed */}
      <div className="space-y-3">
        {emails.map((email) => {
          const isSelected = selectedEmailId === email.id;
          const isUrgent = email.priority_score >= 5 || email.category === 'Urgent';

          return (
            <div
              key={email.id}
              onClick={() => onSelectEmail(email)}
              className={`glass-card rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer ${
                isSelected
                  ? 'border-violet-500 dark:border-violet-400 shadow-md ring-1 ring-violet-500/30 bg-violet-50/20 dark:bg-violet-950/20'
                  : 'border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                
                {/* Sender & Badges */}
                <div className="flex items-center space-x-3 min-w-0">
                  <div className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs flex-shrink-0 text-white ${
                    isUrgent 
                      ? 'bg-gradient-to-tr from-rose-500 to-amber-500' 
                      : 'bg-gradient-to-tr from-violet-600 to-indigo-600'
                  }`}>
                    {(email.sender_name || email.sender || 'U').charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {email.sender_name || email.sender}
                      </span>
                      {email.is_read === 0 && (
                        <span className="w-2 h-2 rounded-full bg-violet-600 flex-shrink-0" title="Unread" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 truncate block">
                      {email.sender}
                    </span>
                  </div>
                </div>

                {/* Right Badges & Time */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getCategoryBadgeClass(email.category)}`}>
                    {email.category}
                  </span>

                  {email.priority_score >= 4 && (
                    <span className="hidden sm:flex items-center space-x-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      <Flame className="w-3 h-3 text-amber-500" />
                      <span>{email.priority_score}/5</span>
                    </span>
                  )}

                  {Boolean(email.is_sensitive) && (
                    <span className="flex items-center space-x-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20" title="Quarantined locally to protect sensitive data">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Shielded ({email.sensitive_type || 'PII'})</span>
                    </span>
                  )}

                  <span className="text-[11px] text-slate-400 font-medium">
                    {formatEmailTime(email.date_received)}
                  </span>
                </div>

              </div>

              {/* Subject */}
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 line-clamp-1">
                {email.subject}
              </h4>

              {/* Snippet / AI Summary Highlight Box */}
              {email.summary ? (
                <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5 flex items-start space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="line-clamp-2">{email.summary}</p>
                </div>
              ) : email.snippet ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2.5">
                  {email.snippet}
                </p>
              ) : null}

              {/* Bottom Tags (Tasks & Drafts count) */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <div className="flex items-center space-x-3">
                  {email.tasks && email.tasks.length > 0 && (
                    <span className="flex items-center space-x-1 text-amber-600 dark:text-amber-400 font-semibold">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{email.tasks.length} {email.tasks.length === 1 ? 'task' : 'tasks'}</span>
                    </span>
                  )}

                  {email.drafts_count > 0 && (
                    <span className="flex items-center space-x-1 text-violet-600 dark:text-violet-400 font-semibold">
                      <Send className="w-3.5 h-3.5" />
                      <span>{email.drafts_count} drafts</span>
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 hover:text-violet-500 transition-colors">
                  View full message &rarr;
                </span>
              </div>

            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {pagination.total > 0 && pagination.totalPages > 1 && (
        <div className="glass-card rounded-2xl p-3.5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing <strong className="text-slate-900 dark:text-white">{startCount}</strong> to <strong className="text-slate-900 dark:text-white">{endCount}</strong> of <strong className="text-slate-900 dark:text-white">{pagination.total}</strong> emails
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange && onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2 font-mono font-bold text-slate-900 dark:text-white">
              {pagination.page} / {pagination.totalPages}
            </span>

            <button
              onClick={() => onPageChange && onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
