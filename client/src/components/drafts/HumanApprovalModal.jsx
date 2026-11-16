import React, { useState, useEffect } from 'react';
import { ShieldCheck, Send, AlertTriangle, X, CheckCircle, Sparkles, Edit3 } from 'lucide-react';

export default function HumanApprovalModal({ draft, isOpen, onClose, onSent }) {
  if (!isOpen || !draft) return null;

  const [toAddress, setToAddress] = useState(draft.to_address || '');
  const [subject, setSubject] = useState(draft.subject || '');
  const [body, setBody] = useState(draft.reply_body || '');
  const [tone, setTone] = useState(draft.tone || 'Professional');
  const [isSending, setIsSending] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (draft) {
      setToAddress(draft.to_address || '');
      setSubject(draft.subject || '');
      setBody(draft.reply_body || '');
      setTone(draft.tone || 'Professional');
      setHasConfirmed(false);
      setError(null);
    }
  }, [draft]);

  const handleSend = async () => {
    if (!hasConfirmed) {
      setError('Please check the confirmation box to authorize sending this email.');
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      const res = await fetch(`/api/drafts/${draft.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmHumanApproval: true,
          overrides: {
            to_address: toAddress,
            subject,
            reply_body: body,
            tone
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch email');
      }

      if (onSent) onSent(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card bg-white dark:bg-[#0E1017] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-white/10 max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Human Approval & Review Required
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              MailMind AI never sends emails autonomously. Review and edit before authorizing dispatch.
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center space-x-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Zero Autonomous Sending: </strong>
            This email will only be dispatched when you check the confirmation box and click "Approve & Send".
          </span>
        </div>

        {/* Editable Form */}
        <div className="space-y-4">
          
          {/* Recipient */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Recipient Address
            </label>
            <input
              type="email"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Tone Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Response Tone
              </label>
              <span className="text-[10px] text-violet-500 font-bold flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>AI Generated ({tone})</span>
              </span>
            </div>
            <div className="flex space-x-2">
              {['Professional', 'Concise', 'Detailed'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    tone === t
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Reply Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Email Body (Editable)
              </label>
              <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                <Edit3 className="w-3 h-3" />
                <span>You can edit this draft freely</span>
              </span>
            </div>
            <textarea
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-500 font-sans"
            />
          </div>

        </div>

        {/* Human Confirmation Checkbox */}
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <label className="flex items-start space-x-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasConfirmed}
              onChange={(e) => setHasConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              I have verified the recipient and email content. I explicitly authorize MailMind AI to send this message on my behalf.
            </span>
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSend}
            disabled={isSending || !hasConfirmed}
            className={`btn-primary text-xs font-bold px-6 py-2.5 space-x-2 ${
              !hasConfirmed ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Send className="w-3.5 h-3.5 text-amber-300" />
            <span>{isSending ? 'Sending via Gmail...' : 'Approve & Send Now'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
