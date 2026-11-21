import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Send, 
  AlertTriangle, 
  X, 
  CheckCircle, 
  Sparkles, 
  Edit3, 
  Paperclip, 
  FileWarning, 
  ShieldAlert, 
  RefreshCw,
  Check,
  ArrowRight,
  Eye,
  Sliders
} from 'lucide-react';
import { apiFetch } from '../../utils/api';

export default function HumanApprovalModal({ draft, isOpen, onClose, onSent }) {
  if (!isOpen || !draft) return null;

  const [toAddress, setToAddress] = useState(draft.to_address || '');
  const [subject, setSubject] = useState(draft.subject || '');
  const [body, setBody] = useState(draft.reply_body || '');
  const [tone, setTone] = useState(draft.tone || 'Professional');
  const [isSending, setIsSending] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [hasAcknowledgedHighRisk, setHasAcknowledgedHighRisk] = useState(false);
  const [error, setError] = useState(null);

  // Regret Shield States
  const [regretCheck, setRegretCheck] = useState(null);
  const [isCheckingRegret, setIsCheckingRegret] = useState(false);

  // Fetch or re-evaluate Regret Shield check
  const runCheck = useCallback(async (textToCheck) => {
    try {
      setIsCheckingRegret(true);
      const res = await apiFetch(`/api/drafts/${draft.id}/check`, {
        method: 'POST',
        body: JSON.stringify({ text: textToCheck })
      });
      const data = await res.json();
      if (data.success && data.check) {
        setRegretCheck(data.check);
        if (data.check.severity !== 'high') {
          setHasAcknowledgedHighRisk(true);
        } else {
          setHasAcknowledgedHighRisk(false);
        }
      }
    } catch (err) {
      console.warn('[Regret Shield UI Notice]', err.message);
    } finally {
      setIsCheckingRegret(false);
    }
  }, [draft.id]);

  useEffect(() => {
    if (draft) {
      const initialBody = draft.reply_body || '';
      setToAddress(draft.to_address || '');
      setSubject(draft.subject || '');
      setBody(initialBody);
      setTone(draft.tone || 'Professional');
      setHasConfirmed(false);
      setHasAcknowledgedHighRisk(false);
      setError(null);
      runCheck(initialBody);
    }
  }, [draft, runCheck]);

  // Apply softer rewrite suggested by LLM
  const handleApplyRewrite = () => {
    if (regretCheck?.softerRewrite) {
      setBody(regretCheck.softerRewrite);
      runCheck(regretCheck.softerRewrite);
    }
  };

  const handleSend = async () => {
    if (!hasConfirmed) {
      setError('Please check the confirmation box to authorize sending this email.');
      return;
    }

    if (regretCheck?.severity === 'high' && !hasAcknowledgedHighRisk) {
      setError('Draft contains high-risk warnings (placeholders, sensitive data, or severe tone). Please acknowledge the risk before proceeding.');
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      const res = await apiFetch(`/api/drafts/${draft.id}/send`, {
        method: 'POST',
        body: JSON.stringify({
          confirmHumanApproval: true,
          acknowledged: Boolean(hasAcknowledgedHighRisk),
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
        if (res.status === 409 && data.regretCheck) {
          setRegretCheck(data.regretCheck);
          throw new Error('Regret Shield blocked dispatch: High-risk elements detected. Please check the acknowledgment box to proceed.');
        }
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

  const severity = regretCheck?.severity || 'pass';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card bg-white dark:bg-[#0E1017] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-white/10 max-h-[90vh] overflow-y-auto space-y-5">
        
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
              MailMind AI never sends emails autonomously. Review and authorize draft creation in Gmail.
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* REGRET SHIELD STATUS STRIP */}
        <div className={`p-4 rounded-2xl border text-xs space-y-3 transition-all ${
          severity === 'high'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
            : severity === 'review'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-bold">
              {severity === 'high' ? (
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              ) : severity === 'review' ? (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              )}
              <span>
                Regret Shield: {severity === 'high' ? 'High-Risk Warnings Detected' : severity === 'review' ? 'Review Recommended' : 'Clean (Best-Effort Passed)'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => runCheck(body)}
              disabled={isCheckingRegret}
              className="flex items-center space-x-1 font-mono text-[11px] opacity-80 hover:opacity-100 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingRegret ? 'animate-spin' : ''}`} />
              <span>Re-check</span>
            </button>
          </div>

          {/* List of Regret Shield Finding Items */}
          {regretCheck?.items?.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-black/10 dark:border-white/10 font-sans">
              {regretCheck.items.map((item, idx) => (
                <div key={idx} className="flex items-start space-x-2 text-[11px]">
                  <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] uppercase ${
                    item.severity === 'HIGH' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'
                  }`}>
                    {item.severity}
                  </span>
                  <p className="opacity-95 leading-snug">
                    {item.message}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Commitments Detected */}
          {regretCheck?.commitments?.length > 0 && (
            <div className="pt-2 border-t border-black/10 dark:border-white/10">
              <span className="text-[10px] uppercase font-mono font-bold block mb-1">
                Detected Commitments & Promises in Draft:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 font-mono">
                {regretCheck.commitments.map((comm, cIdx) => (
                  <li key={cIdx}>{comm}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Diplomatic Rewrite Suggestion */}
          {regretCheck?.softerRewrite && regretCheck.softerRewrite !== body && (
            <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-violet-500" />
                  <span>Suggested Diplomatic Rewrite:</span>
                </span>
                <button
                  type="button"
                  onClick={handleApplyRewrite}
                  className="px-2 py-0.5 rounded-lg bg-violet-600 text-white font-bold text-[10px] hover:bg-violet-700 transition-colors cursor-pointer"
                >
                  Apply Rewrite
                </button>
              </div>
              <p className="text-[11px] p-2 rounded-lg bg-black/5 dark:bg-black/20 italic font-sans leading-relaxed">
                "{regretCheck.softerRewrite}"
              </p>
            </div>
          )}
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                <span>Edits automatically update Regret Shield</span>
              </span>
            </div>
            <textarea
              rows={7}
              value={body}
              onChange={(e) => {
                const val = e.target.value;
                setBody(val);
                // Debounce recheck or run immediately on blur
              }}
              onBlur={() => runCheck(body)}
              className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-500 font-sans"
            />
          </div>

        </div>

        {/* High-Risk Acknowledgment Checkbox (Rendered only if severity is HIGH) */}
        {severity === 'high' && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <label className="flex items-start space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasAcknowledgedHighRisk}
                onChange={(e) => setHasAcknowledgedHighRisk(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold">
                I explicitly acknowledge the high-risk warnings above (e.g. unfilled placeholders, identity credentials, or sensitive data) and confirm I want to save this draft.
              </span>
            </label>
          </div>
        )}

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
              I have verified the recipient and email content. I explicitly authorize MailMind AI to push this draft to my Gmail Drafts folder. (Zero auto-send policy enforced).
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
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSend}
            disabled={isSending || !hasConfirmed || (severity === 'high' && !hasAcknowledgedHighRisk)}
            className={`btn-primary text-xs font-bold px-6 py-2.5 space-x-2 cursor-pointer ${
              !hasConfirmed || (severity === 'high' && !hasAcknowledgedHighRisk) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Send className="w-3.5 h-3.5 text-amber-300" />
            <span>{isSending ? 'Creating Gmail Draft...' : 'Authorize & Push to Gmail'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
