import React, { useState } from 'react';
import { X, KeyRound, ExternalLink, ShieldCheck, Database, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SettingsModal({ isOpen, onClose, onDemoLoaded }) {
  if (!isOpen) return null;

  const { account, isConnected, serverStatus, triggerSync, disconnectAccount } = useAuth();
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState(null);

  const handleSeedDemo = async () => {
    try {
      setIsSeeding(true);
      setSeedMessage(null);
      const res = await fetch('/api/auth/seed-demo', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSeedMessage('Demo inbox loaded successfully with 7 AI categorized & privacy-shielded emails!');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card bg-white dark:bg-[#0E1017] rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-white/10 max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Gmail Connection & Configuration
              </h3>
              <p className="text-xs text-slate-400">
                Secure OAuth 2.0 Credentials & Local SQLite Status
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

        {/* Current Connection Status */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Connected Account
            </span>
            {isConnected ? (
              <span className="flex items-center space-x-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active</span>
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-500">
                Not Connected
              </span>
            )}
          </div>

          {isConnected ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {account?.name || 'Gmail User'}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  {account?.email}
                </p>
              </div>
              <button
                onClick={disconnectAccount}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Connect your real Google account via OAuth 2.0 to sync live messages, or load realistic demo data below to experience all AI features immediately.
              </p>
              <a
                href="/api/auth/url"
                className="btn-primary text-xs font-bold px-4 py-2 space-x-1.5 inline-flex"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                <span>Connect Google Account via OAuth 2.0</span>
              </a>
            </div>
          )}
        </div>

        {/* Instant Demo Data Loader */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-amber-500/10 border border-violet-500/20 space-y-3">
          <div className="flex items-center space-x-2 text-violet-700 dark:text-violet-300 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Instant Demo Experience</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Populate your inbox with 7 realistic emails containing urgent escalations, investor presentations, deadlines, sensitive OTPs, and banking alerts to test the full pipeline.
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

        {/* Security & SQLite Specs */}
        <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-white/10 pt-4">
          <div className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
            <Database className="w-4 h-4 text-violet-500" />
            <span>Local Architecture Guarantees</span>
          </div>
          <ul className="space-y-1 pl-4 list-disc text-[11px] leading-relaxed">
            <li>Tokens & synced emails reside in local SQLite (`server/mailmind.db`).</li>
            <li>Zero cloud sync of your credentials or database.</li>
            <li>Strict regex privacy pre-filter blocks OTPs and cards from Gemini AI.</li>
            <li>100% Human approval required for any outgoing email dispatch.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
