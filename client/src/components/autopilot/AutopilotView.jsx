import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Send, 
  Clock, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  MessageSquare, 
  ArrowRight, 
  Languages, 
  Sliders, 
  Check, 
  Eye, 
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { apiFetch } from '../../utils/api';

export default function AutopilotView({ onOpenApprovalModal, onInspectCheckpoint }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ summary: {}, queue: [], followUps: [] });
  const [activeToneMap, setActiveToneMap] = useState({}); // { [emailId]: 'Professional' | 'Concise' | 'Detailed' }
  const [draftEdits, setDraftEdits] = useState({}); // { [draftId]: string }
  const [customInstructions, setCustomInstructions] = useState({}); // { [emailId]: string }
  const [isRegenerating, setIsRegenerating] = useState({}); // { [emailId]: boolean }
  const [approvingDraftId, setApprovingDraftId] = useState(null);
  const [approvedDrafts, setApprovedDrafts] = useState({}); // { [draftId]: true }
  const [activeSection, setActiveSection] = useState('queue'); // 'queue' | 'followups' | 'quarantined'
  const [statusMessage, setStatusMessage] = useState(null);
  const [pendingRiskCheck, setPendingRiskCheck] = useState(null); // { draft, email, check }

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/autopilot/queue');
      const json = await res.json();
      if (json.success) {
        setData(json);
        // Default each email to 'Professional' tone
        const tones = {};
        json.queue?.forEach(email => {
          tones[email.id] = tones[email.id] || 'Professional';
        });
        setActiveToneMap(prev => ({ ...tones, ...prev }));
      }
    } catch (err) {
      console.error('[Autopilot] Error fetching queue:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load autopilot queue: ' + err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Handle tone change
  const handleToneChange = (emailId, tone) => {
    setActiveToneMap(prev => ({ ...prev, [emailId]: tone }));
  };

  // Handle custom instruction regeneration
  const handleRegenerate = async (email, targetLanguage) => {
    const instruction = customInstructions[email.id];
    if (!instruction?.trim()) return;

    try {
      setIsRegenerating(prev => ({ ...prev, [email.id]: true }));
      setStatusMessage(null);

      const tone = activeToneMap[email.id] || 'Professional';
      const res = await apiFetch('/api/autopilot/generate-draft', {
        method: 'POST',
        body: JSON.stringify({
          emailId: email.id,
          instruction: instruction.trim(),
          tone,
          language: targetLanguage || email.detected_language || 'English'
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to regenerate draft');
      }

      // Add newly generated draft to email drafts list
      setData(prev => {
        const updatedQueue = prev.queue.map(item => {
          if (item.id === email.id) {
            return {
              ...item,
              drafts: [result.draft, ...(item.drafts || [])]
            };
          }
          return item;
        });
        return { ...prev, queue: updatedQueue };
      });

      // Clear input
      setCustomInstructions(prev => ({ ...prev, [email.id]: '' }));
      setStatusMessage({ type: 'success', text: `Draft regenerated with instruction: "${instruction}"` });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsRegenerating(prev => ({ ...prev, [email.id]: false }));
    }
  };

  // Direct approve & push to Gmail draft
  const handleApproveDraft = async (draft, email, acknowledged = false) => {
    if (!draft) return;
    try {
      setApprovingDraftId(draft.id);
      setStatusMessage(null);

      const editedBody = draftEdits[draft.id] !== undefined ? draftEdits[draft.id] : draft.reply_body;

      const res = await apiFetch(`/api/autopilot/approve/${draft.id}`, {
        method: 'POST',
        body: JSON.stringify({
          confirmHumanApproval: true,
          editedBody,
          acknowledged: Boolean(acknowledged)
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        if (res.status === 409 && result.regretCheck) {
          setPendingRiskCheck({
            draft,
            email,
            check: result.regretCheck
          });
          return;
        }
        throw new Error(result.error || 'Failed to approve draft');
      }

      setPendingRiskCheck(null);
      setApprovedDrafts(prev => ({ ...prev, [draft.id]: true }));
      setStatusMessage({
        type: 'success',
        text: `✓ Authorized by you: Draft pushed to Gmail for "${draft.to_address}". (Status: Saved in Gmail Drafts)`
      });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setApprovingDraftId(null);
    }
  };

  const summary = data.summary || { repliesReady: 0, followUpsReady: 0, detainedCount: 0 };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control Strip */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              MailMind Autopilot Engine
            </h2>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold border border-violet-500/20">
              Human-in-the-Loop Safe
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Triage emails requiring reply, review 3-tone adaptive drafts (English/Hindi/Hinglish), and track unresponsive sent threads. Zero auto-send: every action requires explicit human authorization.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          disabled={loading}
          className="flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-slate-200/60 dark:border-white/10 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-violet-500' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Global Status Alert */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl text-xs flex items-center justify-between border ${
          statusMessage.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
        }`}>
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
            )}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
          <button 
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 font-mono"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Card 1: Replies Ready */}
        <div 
          onClick={() => setActiveSection('queue')}
          className={`glass-card rounded-2xl p-5 border cursor-pointer transition-all ${
            activeSection === 'queue'
              ? 'border-violet-500 shadow-lg shadow-violet-500/10 bg-violet-500/5'
              : 'border-slate-200/80 dark:border-white/10 hover:border-violet-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Replies Ready</span>
            <MessageSquare className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {summary.repliesReady || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Direct inquiries awaiting reply approval</p>
        </div>

        {/* Card 2: Follow-ups Pending */}
        <div 
          onClick={() => setActiveSection('followups')}
          className={`glass-card rounded-2xl p-5 border cursor-pointer transition-all ${
            activeSection === 'followups'
              ? 'border-amber-500 shadow-lg shadow-amber-500/10 bg-amber-500/5'
              : 'border-slate-200/80 dark:border-white/10 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Follow-Ups Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {summary.followUpsReady || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sent mails without reply &gt; 3 days</p>
        </div>

        {/* Card 3: Detained / Quarantined */}
        <div 
          onClick={() => setActiveSection('quarantined')}
          className={`glass-card rounded-2xl p-5 border cursor-pointer transition-all ${
            activeSection === 'quarantined'
              ? 'border-rose-500 shadow-lg shadow-rose-500/10 bg-rose-500/5'
              : 'border-slate-200/80 dark:border-white/10 hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Detained Quarantined</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400">
            {summary.detainedCount || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Prompt injections safely locked (Zero AI drafting)</p>
        </div>

      </div>

      {/* Main Content Sections */}

      {/* SECTION 1: NEEDS REPLY QUEUE */}
      {activeSection === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Needs-Reply Work Queue</span>
              <span className="text-xs font-mono text-slate-400">({data.queue?.length || 0})</span>
            </h3>
            <span className="text-xs text-slate-400">
              Newsletters & automated senders filtered out automatically
            </span>
          </div>

          {loading ? (
            <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Analyzing incoming communications & preparing drafts...</span>
            </div>
          ) : data.queue?.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs border border-slate-200/80 dark:border-white/10">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800 dark:text-slate-200">Inbox Zero Replies Needed</p>
              <p className="text-slate-400 mt-1">All direct inquiries have been handled or categorized.</p>
            </div>
          ) : (
            data.queue.map(email => {
              const activeTone = activeToneMap[email.id] || 'Professional';
              const activeDraft = (email.drafts || []).find(d => d.tone === activeTone) || email.drafts?.[0];
              const draftText = activeDraft 
                ? (draftEdits[activeDraft.id] !== undefined ? draftEdits[activeDraft.id] : activeDraft.reply_body)
                : '';
              const isApproved = activeDraft && approvedDrafts[activeDraft.id];
              const isDetained = email.shield_verdict === 'DETAINED';
              const isSuspicious = email.shield_verdict === 'SUSPICIOUS';

              return (
                <div 
                  key={email.id}
                  className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 space-y-4 transition-all"
                >
                  {/* Email Header Strip */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-white/10">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-sm">
                          {email.sender}
                        </span>
                        
                        {/* Urgency Badge */}
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          (email.needs_reply_urgency || email.priority_score) >= 4
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : (email.needs_reply_urgency || email.priority_score) === 3
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                        }`}>
                          Urgency {(email.needs_reply_urgency || email.priority_score || 3)}/5
                        </span>

                        {/* Shield Verdict Badge */}
                        {isDetained ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center space-x-1">
                            <ShieldAlert className="w-3 h-3" />
                            <span>DETAINED</span>
                          </span>
                        ) : isSuspicious ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>SUSPICIOUS</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>CLEARED</span>
                          </span>
                        )}

                        {/* Language Tag */}
                        {email.detected_language && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20 flex items-center space-x-1">
                            <Languages className="w-3 h-3" />
                            <span>{email.detected_language}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {email.subject}
                      </h4>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {email.date_received ? new Date(email.date_received).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>

                  {/* Suspicious Warning Notice */}
                  {isSuspicious && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Caution: Suspicious structural patterns detected.</span>
                        <p className="text-[11px] opacity-90 mt-0.5">
                          MailMind has restricted draft generation strictly to human-visible text. Hidden content has been scrubbed.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI Triage Reason & Suggested Action */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs space-y-1">
                    <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 font-semibold">
                      <Info className="w-3.5 h-3.5 text-violet-500" />
                      <span>Triage Assessment:</span>
                      <span className="text-slate-900 dark:text-white font-normal">
                        {email.needs_reply_reason || email.suggested_action || 'Direct question identified in communication.'}
                      </span>
                    </div>
                  </div>

                  {/* Autopilot Draft Workspace */}
                  {isDetained ? (
                    <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs space-y-2">
                      <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-bold">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Security Quarantine Active: Zero AI Drafting Allowed</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        This communication was detained by MailMind AI Firewall because adversarial prompt injection vectors were detected. Automated drafting is permanently disabled to protect your credentials and workflow.
                      </p>
                      <div className="p-3 rounded-lg bg-black/5 dark:bg-black/30 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        Recommended Human Action: Contact sender via verified out-of-band communication (phone, Slack) to confirm request.
                      </div>
                      {onInspectCheckpoint && (
                        <button
                          onClick={() => onInspectCheckpoint(email.id)}
                          className="mt-2 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          <span>Inspect injection attempt in Checkpoint X-Ray</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      
                      {/* Tone Tabs Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-fit">
                          {['Professional', 'Concise', 'Detailed'].map(tone => (
                            <button
                              key={tone}
                              onClick={() => handleToneChange(email.id, tone)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                activeTone === tone
                                  ? 'bg-violet-600 text-white shadow-sm'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {tone}
                            </button>
                          ))}
                        </div>

                        <span className="text-[11px] text-slate-400 font-mono">
                          Auto-adapted to {email.detected_language || 'English'}
                        </span>
                      </div>

                      {/* Draft Text Area */}
                      <div className="relative">
                        <textarea
                          rows={4}
                          value={draftText}
                          onChange={(e) => {
                            if (activeDraft) {
                              setDraftEdits(prev => ({ ...prev, [activeDraft.id]: e.target.value }));
                            }
                          }}
                          placeholder="Drafting response..."
                          className="w-full text-xs font-sans p-3 rounded-xl bg-white dark:bg-[#0A0C13] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 leading-relaxed"
                        />
                      </div>

                      {/* Tailored Instruction Input */}
                      <div className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={customInstructions[email.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomInstructions(prev => ({ ...prev, [email.id]: val }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRegenerate(email);
                            }}
                            placeholder='Instruction: e.g. "thoda formal karo", "politely decline karo", "ask for Thursday 4pm"'
                            className="w-full text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                        </div>

                        <button
                          onClick={() => handleRegenerate(email)}
                          disabled={!customInstructions[email.id]?.trim() || isRegenerating[email.id]}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white flex items-center space-x-1.5 transition-colors cursor-pointer flex-shrink-0"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isRegenerating[email.id] ? 'animate-spin' : ''}`} />
                          <span>{isRegenerating[email.id] ? 'Re-crafting...' : 'Regenerate'}</span>
                        </button>
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Gated Human Review: Zero Autonomous Dispatches</span>
                        </span>

                        <div className="flex items-center space-x-2">
                          {onOpenApprovalModal && activeDraft && (
                            <button
                              onClick={() => onOpenApprovalModal(activeDraft)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              Open Full Modal
                            </button>
                          )}

                          <button
                            onClick={() => handleApproveDraft(activeDraft, email)}
                            disabled={!activeDraft || approvingDraftId === activeDraft.id || isApproved}
                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                              isApproved
                                ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/30'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 disabled:opacity-40'
                            }`}
                          >
                            {approvingDraftId === activeDraft?.id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Pushed to Gmail...</span>
                              </>
                            ) : isApproved ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Saved in Gmail Drafts</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>Approve & Push to Gmail</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      )}

      {/* SECTION 2: FOLLOW-UP TRACKER */}
      {activeSection === 'followups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Follow-Up Intelligence Tracker</span>
              <span className="text-xs font-mono text-slate-400">({data.followUps?.length || 0})</span>
            </h3>
            <span className="text-xs text-slate-400">
              Threads sent by you without counterparty reply for &ge; 3 days
            </span>
          </div>

          {data.followUps?.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs border border-slate-200/80 dark:border-white/10">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800 dark:text-slate-200">No Stalled Threads</p>
              <p className="text-slate-400 mt-1">All your recent outgoing emails have been answered or are under 3 days old.</p>
            </div>
          ) : (
            data.followUps.map(fu => {
              const draft = fu.draft;
              const isApproved = draft && approvedDrafts[draft.id];

              return (
                <div key={fu.id} className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-white/10">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          To: {fu.sender || fu.to_address}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          {fu.daysAgo || 3} Days Pending
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                        {fu.subject}
                      </h4>
                    </div>
                  </div>

                  {draft && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs">
                        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Prepared Polite Follow-up:
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                          {draft.reply_body}
                        </p>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => handleApproveDraft(draft, fu)}
                          disabled={isApproved || approvingDraftId === draft.id}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                            isApproved
                              ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/30'
                              : 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20'
                          }`}
                        >
                          {isApproved ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Follow-up Saved in Gmail Drafts</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Authorize Follow-Up Draft</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SECTION 3: DETAINED QUARANTINED */}
      {activeSection === 'quarantined' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Security Quarantine Chamber</span>
              <span className="text-xs font-mono text-rose-500 font-bold">({summary.detainedCount || 0} Blocked)</span>
            </h3>
            <span className="text-xs text-slate-400">
              Adversarial injections permanently blocked from AI model context
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-2">
            <div className="flex items-center space-x-2 font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Firewall Fail-Closed Safety Protocol</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              When an email is classified as <span className="font-mono font-bold text-rose-500">DETAINED</span>, MailMind AI completely prevents the LLM from processing or drafting a response to it. This prevents prompt leakage, credential exfiltration, and unauthorized action execution.
            </p>
          </div>

          {summary.detainedCount === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs border border-slate-200/80 dark:border-white/10">
              <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800 dark:text-slate-200">Chamber Clear</p>
              <p className="text-slate-400 mt-1">No detained adversarial payloads detected in your inbox.</p>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6 text-center border border-slate-200/80 dark:border-white/10 space-y-3">
              <p className="text-xs text-slate-400">
                You have {summary.detainedCount} quarantined item(s). Inspect the full breakdown in Checkpoint X-Ray:
              </p>
              {onInspectCheckpoint && (
                <button
                  onClick={() => onInspectCheckpoint(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  Open Checkpoint X-Ray Scanner
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* REGRET SHIELD HIGH-RISK INTERCEPTION MODAL */}
      {pendingRiskCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-card bg-white dark:bg-[#0E1017] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-500/30 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-bold">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <h4 className="text-sm">Regret Shield: High-Risk Alert</h4>
              </div>
              <button
                onClick={() => setPendingRiskCheck(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              MailMind Regret Shield detected high-risk elements in this draft before authorization:
            </p>

            {/* Finding Items */}
            <div className="space-y-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
              {pendingRiskCheck.check?.items?.map((item, idx) => (
                <div key={idx} className="flex items-start space-x-2">
                  <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-rose-500 text-white uppercase flex-shrink-0 mt-0.5">
                    {item.severity}
                  </span>
                  <p className="text-rose-700 dark:text-rose-300 text-[11px] leading-snug">
                    {item.message}
                  </p>
                </div>
              ))}
            </div>

            {/* Commitments Detected */}
            {pendingRiskCheck.check?.commitments?.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 text-xs space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
                  Binding Commitments in Draft:
                </span>
                <ul className="list-disc list-inside text-[11px] text-slate-700 dark:text-slate-300 font-mono">
                  {pendingRiskCheck.check.commitments.map((comm, cIdx) => (
                    <li key={cIdx}>{comm}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => {
                  const d = pendingRiskCheck.draft;
                  setPendingRiskCheck(null);
                  if (onOpenApprovalModal) onOpenApprovalModal(d);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                Review in Full Editor
              </button>

              <button
                onClick={() => handleApproveDraft(pendingRiskCheck.draft, pendingRiskCheck.email, true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 transition-all cursor-pointer"
              >
                Acknowledge & Save Draft
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
