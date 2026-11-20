import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Mail, Send, Sparkles, Filter, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../utils/api';

export default function ActivityLogsView() {
  const [logs, setLogs] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const url = severityFilter ? `/api/logs?severity=${severityFilter}` : '/api/logs';
      const res = await apiFetch(url);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [severityFilter]);

  const getEventIcon = (eventType, severity) => {
    if (severity === 'SECURITY') {
      return <ShieldAlert className="w-4 h-4 text-amber-500" />;
    }
    switch (eventType) {
      case 'OAUTH_CONNECTED':
      case 'OAUTH_DISCONNECTED':
        return <KeyRound className="w-4 h-4 text-violet-500" />;
      case 'DRAFT_APPROVED_SENT':
      case 'EMAIL_SENT':
        return <Send className="w-4 h-4 text-emerald-500" />;
      case 'AI_CLASSIFIED':
        return <Sparkles className="w-4 h-4 text-pink-500" />;
      case 'SYNC_COMPLETED':
        return <Mail className="w-4 h-4 text-sky-500" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-slate-400" />;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'SECURITY':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            PRIVACY SHIELD
          </span>
        );
      case 'WARNING':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            WARNING
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400">
            AUDIT
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-sky-500" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Security Audit & Activity Feed
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable audit record of all incoming triage, zero-leak privacy quarantines, and human-authorized dispatches.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">All Events</option>
            <option value="SECURITY">Security / Privacy Shield</option>
            <option value="INFO">Standard Audit Logs</option>
          </select>

          <button
            onClick={fetchLogs}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs Table / List */}
      {isLoading ? (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Retrieving security records...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-slate-200/80 dark:border-white/10 space-y-3">
          <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            No activity records found
          </h4>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-4 sm:p-6 border border-slate-200/80 dark:border-white/10 space-y-3 font-mono text-xs">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start space-x-3">
                <div className="p-1.5 rounded-lg bg-slate-200/60 dark:bg-white/10 flex-shrink-0 mt-0.5">
                  {getEventIcon(log.event_type, log.severity)}
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {log.event_type}
                    </span>
                    {getSeverityBadge(log.severity)}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 font-sans text-xs">
                    {log.message}
                  </p>
                </div>
              </div>

              <span className="text-[11px] text-slate-400 flex-shrink-0">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
