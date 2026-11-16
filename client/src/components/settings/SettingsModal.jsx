import React, { useState } from 'react';
import { 
  X, 
  KeyRound, 
  ExternalLink, 
  ShieldCheck, 
  Database, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  Globe
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SettingsModal({ isOpen, onClose, onDemoLoaded }) {
  if (!isOpen) return null;

  const { account, isConnected, isDemoMode, isLiveMode, serverStatus, triggerSync, disconnectAccount, connectGmail } = useAuth();
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [connectError, setConnectError] = useState(null);

  const redirectUri = 'http://localhost:5001/api/auth/callback';

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConnectLive = async () => {
    setConnectError(null);
    try {
      await connectGmail();
    } catch (err) {
      setConnectError(err.message || 'Google OAuth credentials not configured on backend.');
    }
  };

  const handleSeedDemo = async () => {
    try {
      setIsSeeding(true);
      setSeedMessage(null);
      const res = await fetch('/api/auth/seed-demo', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSeedMessage('Demo inbox populated with 7 realistic emails (urgent, meetings, tasks & sensitive shields).');
        if (onDemoLoaded) onDemoLoaded();
        triggerSync();
      } else {
        setSeedMessage(data.message || 'Demo inbox already loaded.');
      }
    } catch (err) {
      setSeedMessage('Failed to load demo data: ' + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const isOAuthConfigured = Boolean(serverStatus?.config?.oauthConfigured);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card bg-white dark:bg-[#0E1017] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-white/10 max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Gmail Connection & OAuth 2.0 Setup
              </h3>
              <p className="text-xs text-slate-400">
                Minimum permissions, live synchronization, and local credential safety
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Connection Status Pill */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Connection Status
            </span>

            {isLiveMode ? (
              <span className="flex items-center space-x-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Gmail Connected</span>
              </span>
            ) : isDemoMode ? (
              <span className="flex items-center space-x-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Demo Evaluation Mode</span>
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-white/10 px-2.5 py-1 rounded-full">
                Disconnected
              </span>
            )}
          </div>

          {isConnected ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {account?.name || 'Gmail User'}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  {account?.email}
                </p>
                {account?.last_synced_at && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Last Synced: {new Date(account.last_synced_at).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => triggerSync()}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-950/60 hover:bg-violet-200 dark:hover:bg-violet-900/60 transition-colors"
                >
                  Sync Now
                </button>
                <button
                  onClick={disconnectAccount}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Connect your real Gmail account to read recent emails and prepare reply drafts. Minimum permissions are enforced: <code className="text-violet-600 dark:text-violet-400 font-bold">gmail.readonly</code> and <code className="text-violet-600 dark:text-violet-400 font-bold">gmail.compose</code> only. (Zero auto-send).
              </p>
              
              <button
                onClick={handleConnectLive}
                className="btn-primary text-xs font-bold px-4 py-2.5 space-x-2 inline-flex"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                <span>Connect Live Gmail (OAuth 2.0)</span>
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

        {/* Google Cloud Console Setup Instructions */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Globe className="w-4 h-4 text-violet-500" />
              <span>Google Cloud Credentials Setup</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isOAuthConfigured 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              {isOAuthConfigured ? 'Configured in .env' : 'Missing in server/.env'}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            To connect a live Google account, configure OAuth credentials in Google Cloud Console:
          </p>

          <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed">
            <li>
              Open <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-violet-600 dark:text-violet-400 underline font-semibold">Google Cloud Console</a> and create or select a project.
            </li>
            <li>
              Go to <strong>APIs & Services &gt; Library</strong>, search for <strong>Gmail API</strong>, and click <strong>Enable</strong>.
            </li>
            <li>
              Go to <strong>APIs & Services &gt; OAuth consent screen</strong>:
              <ul className="list-disc pl-4 text-[11px] text-slate-500 mt-0.5">
                <li>Choose User Type: <strong>External</strong></li>
                <li>Add your own Gmail address as a <strong>Test User</strong></li>
              </ul>
            </li>
            <li>
              Go to <strong>APIs & Services &gt; Credentials &gt; Create Credentials &gt; OAuth Client ID</strong>:
              <ul className="list-disc pl-4 text-[11px] text-slate-500 mt-0.5">
                <li>Application Type: <strong>Web application</strong></li>
                <li>Authorized JavaScript origins: <code className="bg-slate-200 dark:bg-white/10 px-1 rounded">http://localhost:5174</code></li>
                <li>Authorized redirect URI:
                  <div className="flex items-center space-x-2 mt-1">
                    <code className="bg-slate-200 dark:bg-white/10 px-2 py-1 rounded text-violet-600 dark:text-violet-300 font-mono text-[11px]">
                      {redirectUri}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(redirectUri, 'uri')}
                      className="p-1 rounded bg-slate-200 dark:bg-white/10 hover:bg-slate-300 text-slate-600 dark:text-slate-300"
                      title="Copy URI"
                    >
                      {copiedField === 'uri' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </li>
              </ul>
            </li>
            <li>
              Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> into <code className="bg-slate-200 dark:bg-white/10 px-1 rounded">server/.env</code>:
              <pre className="font-mono text-[11px] bg-slate-900 text-slate-200 p-2.5 rounded-xl mt-1 overflow-x-auto">
{`GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5001/api/auth/callback`}
              </pre>
            </li>
          </ol>
        </div>

        {/* Demo Experience Sandbox */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-amber-500/10 border border-violet-500/20 space-y-2.5">
          <div className="flex items-center space-x-2 text-violet-700 dark:text-violet-300 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Demo Mode Sandbox</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Need to evaluate without configuring Google Cloud first? Load our realistic inbox dataset with 7 AI-categorized emails, action item deadlines, sensitive OTP shields, and reply drafts.
          </p>

          <button
            onClick={handleSeedDemo}
            disabled={isSeeding}
            className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Analyzing & Populating...' : 'Load Realistic Demo Inbox'}</span>
          </button>

          {seedMessage && (
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-1 text-center">
              {seedMessage}
            </p>
          )}
        </div>

        {/* Security Summary */}
        <div className="text-[11px] text-slate-400 dark:text-slate-500 space-y-1 border-t border-slate-200/60 dark:border-white/10 pt-3">
          <div className="flex items-center space-x-1.5 font-bold text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Security Guarantees:</span>
          </div>
          <p>
            Tokens stay exclusively on your local machine in SQLite. No emails are ever auto-sent, auto-deleted, or forwarded. Sensitive data (OTPs, banking) is sanitized locally before reaching external AI.
          </p>
        </div>

      </div>
    </div>
  );
}
