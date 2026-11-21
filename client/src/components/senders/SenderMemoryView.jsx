import React, { useState, useEffect, useCallback } from 'react';
import { 
  UserCheck, 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  RefreshCw, 
  Trash2, 
  Ban, 
  Check, 
  HelpCircle, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  Clock,
  Mail,
  Send
} from 'lucide-react';
import { apiFetch } from '../../utils/api';

/**
 * SenderMemoryView — MailMind AI Sender Trust & Memory Management
 * 
 * Allows users to inspect known senders, view email counts and sent interaction telemetry,
 * configure trust / block states, rebuild memory, or trigger bulk erasure (GDPR/Forget All).
 */
export default function SenderMemoryView() {
  const [senders, setSenders] = useState([]);
  const [stats, setStats] = useState({ total: 0, trusted: 0, blocked: 0, unknown: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [selectedState, setSelectedState] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isForgetModalOpen, setIsForgetModalOpen] = useState(false);
  const [isForgetting, setIsForgetting] = useState(false);

  // Fetch Senders List
  const fetchSenders = useCallback(async () => {
    try {
      setIsLoading(true);
      setActionError(null);
      const params = new URLSearchParams();
      if (selectedState && selectedState !== 'all') {
        params.append('state', selectedState);
      }
      if (searchQuery.trim()) {
        params.append('q', searchQuery.trim());
      }
      params.append('page', pagination.page.toString());
      params.append('limit', '20');

      const res = await apiFetch(`/api/senders?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSenders(data.senders || []);
        if (data.pagination) setPagination(data.pagination);
        if (data.stats) setStats(data.stats);
      } else {
        setActionError(data.error || 'Failed to fetch senders.');
      }
    } catch (err) {
      console.error('[SenderMemoryView Fetch Error]', err);
      setActionError('Network error connecting to sender memory service.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedState, searchQuery, pagination.page]);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  // Update Trust State (Trusted | Blocked | Unknown)
  const handleUpdateTrust = async (senderId, nextState) => {
    try {
      setActionError(null);
      const res = await apiFetch(`/api/senders/${senderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ trust_state: nextState })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Sender marked as ${nextState}.`);
        setTimeout(() => setActionSuccess(null), 3000);
        fetchSenders();
      } else {
        setActionError(data.error || 'Failed to update sender trust state.');
      }
    } catch (err) {
      setActionError('Network error while updating sender trust state.');
    }
  };

  // Delete Individual Sender
  const handleDeleteSender = async (senderId) => {
    if (!window.confirm('Delete this sender profile from memory?')) return;
    try {
      setActionError(null);
      const res = await apiFetch(`/api/senders/${senderId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Sender profile deleted.');
        setTimeout(() => setActionSuccess(null), 3000);
        fetchSenders();
      } else {
        setActionError(data.error || 'Failed to delete sender.');
      }
    } catch (err) {
      setActionError('Network error deleting sender profile.');
    }
  };

  // Rebuild Sender Memory from Stored Emails
  const handleRebuildMemory = async () => {
    try {
      setIsRebuilding(true);
      setActionError(null);
      const res = await apiFetch('/api/senders/rebuild', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message || 'Sender memory successfully rebuilt.');
        setTimeout(() => setActionSuccess(null), 4000);
        fetchSenders();
      } else {
        setActionError(data.error || 'Failed to rebuild sender memory.');
      }
    } catch (err) {
      setActionError('Network error rebuilding sender memory.');
    } finally {
      setIsRebuilding(false);
    }
  };

  // Bulk Forget All Sender Memory
  const handleForgetAll = async () => {
    try {
      setIsForgetting(true);
      setActionError(null);
      const res = await apiFetch('/api/senders?confirm=true', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setIsForgetModalOpen(false);
        setActionSuccess('All sender memory profiles and header telemetry permanently forgotten.');
        setTimeout(() => setActionSuccess(null), 5000);
        fetchSenders();
      } else {
        setActionError(data.error || 'Failed to erase sender memory.');
      }
    } catch (err) {
      setActionError('Network error forgetting sender memory.');
    } finally {
      setIsForgetting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      
      {/* Top Header Card */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
                <UserCheck className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Layer 4 Defense Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Sender Trust Memory
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Continuously maps verified sender history, SPF/DKIM/DMARC telemetry, and lookalike domain spoofing.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <button
              onClick={handleRebuildMemory}
              disabled={isRebuilding}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-500 ${isRebuilding ? 'animate-spin' : ''}`} />
              <span>{isRebuilding ? 'Rebuilding...' : 'Rebuild Memory'}</span>
            </button>

            <button
              onClick={() => setIsForgetModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Forget All Memory</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2 animate-fade-in">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2 animate-fade-in">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Honest Best-Effort Heuristic Guarantee Banner */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs text-slate-600 dark:text-slate-400 flex items-start space-x-3">
          <Info className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-slate-900 dark:text-white">
              Heuristic Identity Protection Model (Best-Effort)
            </span>
            <p className="leading-relaxed">
              Sender Trust Memory uses relationship history, homoglyph distance, and Google Authentication headers to detect impersonation. 
              <strong> Crucial Safety Invariant:</strong> Marking a contact as "Trusted" never bypasses MailMind Shield's Prompt Injection or Steganography filters. If an email from a trusted contact contains an adversarial payload, it is strictly <strong>DETAINED</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-white/10 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Total Senders</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-white/10 space-y-1">
          <span className="text-[10px] font-mono uppercase text-emerald-500 font-bold">Trusted Contacts</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.trusted}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-white/10 space-y-1">
          <span className="text-[10px] font-mono uppercase text-rose-500 font-bold">Blocked Senders</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{stats.blocked}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-white/10 space-y-1">
          <span className="text-[10px] font-mono uppercase text-amber-500 font-bold">Unclassified</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.unknown}</p>
        </div>
      </div>

      {/* Search & State Filter Tabs */}
      <div className="glass-card rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search senders by email address or display name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-transparent focus:border-emerald-500 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs flex-shrink-0">
            {['all', 'trusted', 'blocked', 'unknown'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setSelectedState(st);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                  selectedState === st
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Senders Table / List */}
      <div className="glass-card rounded-3xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
            <p className="text-xs font-mono">Loading sender identity profiles...</p>
          </div>
        ) : senders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <UserCheck className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No sender profiles found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Sender profiles are automatically indexed as emails arrive or can be backfilled using the "Rebuild Memory" button above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/60 dark:divide-white/10">
            {senders.map((snd) => {
              const isTrusted = snd.trust_state === 'trusted';
              const isBlocked = snd.trust_state === 'blocked';

              return (
                <div
                  key={snd.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                >
                  {/* Left: Avatar & Identity Details */}
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs text-white flex-shrink-0 shadow-sm ${
                      isTrusted
                        ? 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                        : isBlocked
                          ? 'bg-gradient-to-tr from-rose-600 to-red-500'
                          : 'bg-gradient-to-tr from-slate-600 to-slate-700'
                    }`}>
                      {(snd.display_name || snd.sender_email).charAt(0).toUpperCase()}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {snd.display_name}
                        </span>
                        
                        {/* Trust State Badge */}
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                          isTrusted
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : isBlocked
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                              : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                        }`}>
                          {snd.trust_state}
                        </span>

                        {Boolean(snd.user_set) && (
                          <span className="text-[9px] font-mono text-violet-500 bg-violet-500/10 px-1.5 py-0.2 rounded border border-violet-500/20" title="Explicitly configured by you">
                            Manual
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                        {snd.sender_email}
                      </p>

                      {/* Interaction Telemetry */}
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 pt-0.5">
                        <span className="flex items-center space-x-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>Received: <strong>{snd.received_count || 1}</strong></span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Send className="w-3 h-3 text-slate-400" />
                          <span>Sent to: <strong>{snd.sent_to_count || 0}</strong></span>
                        </span>
                        <span className="hidden sm:inline text-slate-500">|</span>
                        <span className="hidden sm:inline font-mono">
                          Domain: {snd.sender_domain}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick State Actions */}
                  <div className="flex items-center space-x-2 flex-shrink-0 self-end md:self-center">
                    {!isTrusted && (
                      <button
                        onClick={() => handleUpdateTrust(snd.id, 'trusted')}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-500/30 transition-colors cursor-pointer"
                        title="Mark as Trusted contact"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Trust</span>
                      </button>
                    )}

                    {!isBlocked && (
                      <button
                        onClick={() => handleUpdateTrust(snd.id, 'blocked')}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-500/30 transition-colors cursor-pointer"
                        title="Block sender (All future emails DETAINED)"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block</span>
                      </button>
                    )}

                    {(isTrusted || isBlocked) && (
                      <button
                        onClick={() => handleUpdateTrust(snd.id, 'unknown')}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        title="Reset trust state to unknown"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteSender(snd.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete sender profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} senders)
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Forget All Sender Memory */}
      {isForgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full border border-rose-500/30 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Forget All Sender Memory?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This will permanently delete all contact trust states, interaction tallies, and SPF/DKIM telemetry recorded for your account. 
                You can recalibrate memory at any time by clicking "Rebuild Memory".
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setIsForgetModalOpen(false)}
                disabled={isForgetting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleForgetAll}
                disabled={isForgetting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isForgetting ? 'Erasing...' : 'Yes, Forget All'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
