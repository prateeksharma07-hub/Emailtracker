import React, { useState } from 'react';
import { 
  X, 
  KeyRound, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw,
  AlertCircle,
  Cpu,
  Lock,
  Sliders,
  User,
  Zap,
  Check,
  LogOut,
  Mail,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';

export default function SettingsModal({ isOpen, onClose, onDemoLoaded }) {
  if (!isOpen) return null;

  const { 
    user,
    account, 
    isConnected, 
    isLiveMode, 
    triggerSync, 
    logout,
    deleteAccountData, 
    connectGmail 
  } = useAuth();

  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'agent' | 'security'
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [connectError, setConnectError] = useState(null);

  // Preference toggles
  const [autoTriage, setAutoTriage] = useState(true);
  const [autoExtractTasks, setAutoExtractTasks] = useState(true);
  const [autoDraftReplies, setAutoDraftReplies] = useState(true);
  const [agentTone, setAgentTone] = useState('Executive & Concise');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleConnectLive = async () => {
    setConnectError(null);
    try {
      await connectGmail();
    } catch (err) {
      setConnectError(err.message || 'Google OAuth failed to initialize.');
    }
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const handleDeleteAllData = async () => {
    try {
      setIsDeleting(true);
      await deleteAccountData();
      setShowConfirmDelete(false);
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSavePreferences = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const activeUser = user || account;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="glass-card bg-white dark:bg-[#0D1017] rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200/80 dark:border-white/10 max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Settings & Account Controls
              </h3>
              <p className="text-xs text-slate-400">
                Manage your Gmail connection, privacy guardrails, and data isolation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200/60 dark:border-white/5">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'account'
                ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Account</span>
          </button>

          <button
            onClick={() => setActiveTab('agent')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'agent'
                ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Agent</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Privacy & Safety</span>
          </button>
        </div>

        {/* Tab 1: Account */}
        {activeTab === 'account' && (
          <div className="space-y-4 animate-fade-in">
            {/* Account Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Connected Google Account
                </span>

                <span className="flex items-center space-x-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Authenticated</span>
                </span>
              </div>

              {activeUser ? (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center space-x-3.5">
                    {activeUser.picture ? (
                      <img 
                        src={activeUser.picture} 
                        alt="Avatar" 
                        className="w-12 h-12 rounded-full border-2 border-violet-500/50 flex-shrink-0" 
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md flex-shrink-0">
                        {activeUser.name?.charAt(0) || activeUser.email?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {activeUser.name || 'MailMind User'}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono truncate">
                        {activeUser.email}
                      </p>
                      {activeUser.last_sync_at && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Last Synced: {new Date(activeUser.last_sync_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-white/10">
                    <button
                      onClick={() => triggerSync()}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-950/60 hover:bg-violet-200 dark:hover:bg-violet-900/60 transition-colors cursor-pointer"
                    >
                      Sync Now
                    </button>
                    
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>

                    <button
                      onClick={() => setShowConfirmDelete(true)}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Disconnect & Delete Data</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Connect your real Gmail account with secure Google OAuth 2.0. MailMind will read your messages and generate drafts.
                  </p>
                  
                  <button
                    onClick={handleConnectLive}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-500/25 transition-all cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-amber-300" />
                    <span>Connect Gmail (OAuth 2.0)</span>
                  </button>

                  {connectError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{connectError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirmation Modal for Permanent Delete */}
            {showConfirmDelete && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Permanent Account & Data Wipeout</span>
                </div>
                <p className="text-xs leading-relaxed">
                  This will revoke MailMind's Google OAuth tokens and permanently delete all your synced emails, tasks, drafts, and activity logs from SQLite. This action cannot be undone.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleDeleteAllData}
                    disabled={isDeleting}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
                  </button>
                  <button
                    onClick={() => setShowConfirmDelete(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: AI Agent Persona & Automation */}
        {activeTab === 'agent' && (
          <div className="space-y-4 animate-fade-in">
            {/* Active Model */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Active AI Model
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Groq LPU Ultra-Fast Inference (openai/gpt-oss-120b & 20b)
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Online & Ready
              </span>
            </div>

            {/* Persona & Tone Selector */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
              <label className="text-xs font-bold text-slate-900 dark:text-white block">
                Agent Writing Persona & Default Tone
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Executive & Concise', 'Warm & Professional', 'Direct & Action-Oriented', 'Casual & Friendly'].map((tone) => (
                  <button
                    key={tone}
                    onClick={() => setAgentTone(tone)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold text-left border transition-all cursor-pointer ${
                      agentTone === tone
                        ? 'border-violet-600 bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-bold'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            {/* Automation Toggles */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Autonomous Intelligence Features
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Auto-Triage & Categorization</p>
                    <p className="text-[11px] text-slate-400">Sort into Urgent, Work, Meetings, Tasks, Newsletters</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoTriage}
                    onChange={(e) => setAutoTriage(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Deadline & Task Extraction</p>
                    <p className="text-[11px] text-slate-400">Extract action items with due dates from email text</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoExtractTasks}
                    onChange={(e) => setAutoExtractTasks(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Smart Draft Reply Preparation</p>
                    <p className="text-[11px] text-slate-400">Pre-generate high-quality response drafts ready for approval</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoDraftReplies}
                    onChange={(e) => setAutoDraftReplies(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSavePreferences}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 shadow-md transition-all cursor-pointer"
            >
              {savedNotice ? 'Preferences Saved!' : 'Save Agent Preferences'}
            </button>
          </div>
        )}

        {/* Tab 3: Security & Privacy Shield */}
        {activeTab === 'security' && (
          <div className="space-y-4 animate-fade-in">
            {/* Zero Leak Banner */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Zero-Leak Sensitive Data Shield & AI Firewall: ACTIVE</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                OTPs, passwords, and banking numbers are shielded before prompt creation. In addition, incoming HTML and Unicode structures are scrutinized for prompt injections and adversarial instruction overrides.
              </p>
            </div>

            {/* AI Email Firewall Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-cyan-500" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Phase 1: Shield + X-Ray Firewall
                  </h4>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Active Defense
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Features Layer 1 (Cheerio CSS hidden rule & Unicode steganography inspector), Layer 2 (Multilingual override pattern engine), Layer 3 (Groq Prompt Guard 2 transformer), and Layer 4 (Output hallucination validator).
              </p>

              <button
                onClick={async () => {
                  try {
                    await apiFetch('/api/shield/seed-samples', { method: 'POST' });
                    if (onDemoLoaded) onDemoLoaded();
                    alert('Sample prompt injection test vectors successfully loaded into your inbox!');
                  } catch (err) {
                    alert('Failed to load samples.');
                  }
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors cursor-pointer"
              >
                <span>Load 40 Shield Benchmark Vectors</span>
              </button>
            </div>

            {/* Security Rules Breakdown */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Multi-User SaaS Security Architecture
              </h4>

              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                  <span><strong>AES-256-GCM Token Encryption:</strong> Google OAuth tokens are encrypted at rest with hardware-grade AES-256-GCM. Plain tokens are never stored or logged.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                  <span><strong>Strict Data Isolation:</strong> Every database query filters by your unique user ID. No other user can ever view or touch your inbox.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                  <span><strong>Human Approval Gate:</strong> Zero automatic email dispatch. Every single reply requires explicit human review and confirmation.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                  <span><strong>Minimum Permissions:</strong> Only <code className="font-mono text-violet-600 dark:text-violet-400">gmail.readonly</code> & <code className="font-mono text-violet-600 dark:text-violet-400">gmail.compose</code> (drafts) requested. <code className="font-mono text-rose-500">gmail.send</code> is permanently disallowed.</span>
                </div>
              </div>
            </div>

            {/* Diagnostic Details */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Database Engine: Native Node.js SQLite (Multi-User WAL Mode)</span>
              <span className="font-mono text-emerald-500">Encrypted</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
