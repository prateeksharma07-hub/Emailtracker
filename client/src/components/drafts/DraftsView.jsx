import React, { useState, useEffect } from 'react';
import { FileEdit, Send, CheckCircle2, XCircle, AlertTriangle, Clock, Sparkles, Trash2 } from 'lucide-react';
import { apiFetch } from '../../utils/api';

export default function DraftsView({ onOpenApprovalModal }) {
  const [drafts, setDrafts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchDrafts = async () => {
    try {
      setIsLoading(true);
      const url = statusFilter ? `/api/drafts?status=${statusFilter}` : '/api/drafts';
      const res = await apiFetch(url);
      const data = await res.json();
      if (data.success) {
        setDrafts(data.drafts || []);
      }
    } catch (err) {
      console.error('Failed to fetch drafts', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, [statusFilter]);

  const handleDiscard = async (draftId) => {
    try {
      await apiFetch(`/api/drafts/${draftId}`, { method: 'DELETE' });
      fetchDrafts();
    } catch (err) {
      console.error('Failed to discard draft', err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Status Filter Tabs */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FileEdit className="w-5 h-5 text-pink-500" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              AI Reply Drafts & Approval Queue
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Strict Human-in-the-Loop: Review, customize, and authorize each response before sending.
          </p>
        </div>

        <div className="flex space-x-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl text-xs">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              statusFilter === '' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            All Drafts
          </button>
          <button
            onClick={() => setStatusFilter('PENDING_APPROVAL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              statusFilter === 'PENDING_APPROVAL' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Pending Review
          </button>
          <button
            onClick={() => setStatusFilter('SENT')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              statusFilter === 'SENT' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Dispatched (Sent)
          </button>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-700 dark:text-slate-300 flex items-center space-x-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        <div>
          <span className="font-bold text-slate-900 dark:text-white">Human Approval Safeguard Active: </span>
          MailMind AI prepares draft options across multiple professional tones, but zero messages are dispatched without your explicit verification and authorization.
        </div>
      </div>

      {/* Drafts Feed */}
      {isLoading ? (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Loading approval queue...</span>
        </div>
      ) : drafts.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-slate-200/80 dark:border-white/10 space-y-3">
          <FileEdit className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            No drafts currently in queue
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            When MailMind receives emails, suggested response drafts will appear here for your review and approval.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 space-y-4 transition-all hover:border-slate-300 dark:hover:border-white/20"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-white/10">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      {draft.tone} Tone
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      To: {draft.to_address}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Original Subject: {draft.original_subject || draft.subject}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {draft.status === 'SENT' ? (
                    <span className="flex items-center space-x-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sent on {new Date(draft.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Awaiting Human Approval</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Draft Body Content */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                {draft.reply_body}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => handleDiscard(draft.id)}
                  className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Discard Draft</span>
                </button>

                {draft.status === 'PENDING_APPROVAL' && (
                  <button
                    onClick={() => onOpenApprovalModal(draft)}
                    className="btn-primary text-xs font-bold px-5 py-2 space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-300" />
                    <span>Review & Authorize Send</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
