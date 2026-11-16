import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { 
  Inbox, 
  Sparkles, 
  ShieldCheck, 
  Sun, 
  Moon, 
  Mail, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Send, 
  FileEdit, 
  BarChart3, 
  ShieldAlert, 
  Flame, 
  Briefcase, 
  Calendar, 
  UserCheck, 
  Newspaper, 
  RefreshCw, 
  Search, 
  CheckSquare, 
  KeyRound,
  Settings,
  Layers
} from 'lucide-react';

import EmailList from './components/inbox/EmailList';
import EmailDetail from './components/inbox/EmailDetail';
import HumanApprovalModal from './components/drafts/HumanApprovalModal';
import DraftsView from './components/drafts/DraftsView';
import TasksView from './components/tasks/TasksView';
import AnalyticsView from './components/analytics/AnalyticsView';
import ActivityLogsView from './components/logs/ActivityLogsView';
import SettingsModal from './components/settings/SettingsModal';

export default function App() {
  const { account, isConnected, isSyncing, serverStatus, triggerSync } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Navigation & View States
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'tasks' | 'drafts' | 'analytics' | 'logs'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Data States
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isLoadingEmails, setIsLoadingEmails] = useState(true);
  const [approvalDraft, setApprovalDraft] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Fetch Emails with active filters
  const fetchEmails = useCallback(async () => {
    try {
      setIsLoadingEmails(true);
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      if (priorityFilter) {
        params.append('priority', priorityFilter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/emails?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails || []);
      }
    } catch (err) {
      console.error('Failed to fetch emails', err);
    } finally {
      setIsLoadingEmails(false);
    }
  }, [selectedCategory, priorityFilter, searchQuery]);

  // Fetch summary analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    }
  }, []);

  // Reload when filters or sync changes
  useEffect(() => {
    fetchEmails();
    fetchAnalytics();
  }, [fetchEmails, fetchAnalytics, isSyncing]);

  // Load single email detail
  const handleSelectEmail = async (email) => {
    try {
      const res = await fetch(`/api/emails/${email.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedEmail(data.email);
        // Mark as read locally and remotely
        if (!email.is_read) {
          fetch(`/api/emails/${email.id}/read`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_read: 1 })
          });
          setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: 1 } : e));
        }
      }
    } catch (err) {
      console.error('Failed to fetch full email detail', err);
    }
  };

  const handleSelectEmailById = (emailId) => {
    setActiveTab('inbox');
    handleSelectEmail({ id: emailId });
  };

  const handleDeleteEmail = async (emailId) => {
    try {
      await fetch(`/api/emails/${emailId}`, { method: 'DELETE' });
      setSelectedEmail(null);
      fetchEmails();
      fetchAnalytics();
    } catch (err) {
      console.error('Failed to delete email', err);
    }
  };

  const handleToggleTask = async (taskId, nextStatus) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: nextStatus ? 1 : 0 })
      });
      if (selectedEmail) {
        handleSelectEmail(selectedEmail);
      }
      fetchAnalytics();
    } catch (err) {
      console.error('Failed to toggle task', err);
    }
  };

  const categories = [
    { id: 'all', label: 'All Messages', icon: Inbox, count: analyticsData?.metrics?.totalEmails || emails.length },
    { id: 'Urgent', label: 'Urgent', icon: Flame, count: analyticsData?.categories?.Urgent || 0, badgeClass: 'badge-urgent' },
    { id: 'Work', label: 'Work', icon: Briefcase, count: analyticsData?.categories?.Work || 0, badgeClass: 'badge-work' },
    { id: 'Meeting', label: 'Meetings', icon: Calendar, count: analyticsData?.categories?.Meeting || 0, badgeClass: 'badge-meeting' },
    { id: 'Task', label: 'Tasks', icon: CheckSquare, count: analyticsData?.categories?.Task || 0, badgeClass: 'badge-task' },
    { id: 'Personal', label: 'Personal', icon: UserCheck, count: analyticsData?.categories?.Personal || 0, badgeClass: 'badge-personal' },
    { id: 'Newsletter', label: 'Newsletters', icon: Newspaper, count: analyticsData?.categories?.Newsletter || 0, badgeClass: 'badge-newsletter' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#08090E] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-250">
      
      {/* Top Floating Glass Header */}
      <header className="sticky top-3 z-40 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-3 no-print">
        <nav className="glass-card rounded-2xl px-4 sm:px-6 py-3 shadow-xl border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          
          {/* Brand Mark */}
          <div 
            onClick={() => { setActiveTab('inbox'); setSelectedEmail(null); }}
            className="flex items-center space-x-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-pink-500 to-amber-400 p-[1.5px] shadow-md shadow-violet-500/20 flex-shrink-0">
              <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center">
                <Mail className="w-5 h-5 text-amber-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                  MAILMIND <span className="text-gradient-aurora">AI</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 shadow-xs">
                  Autonomous Agent
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Intelligent Email Management & Privacy-First Automation
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Gemini Model Engine Status */}
            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Gemini 3.5 Active</span>
            </div>

            {/* Zero-Leak Shield Status */}
            <div className="hidden md:flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60" title="Zero sensitive bytes sent to external AI">
              <ShieldCheck className="w-3.5 h-3.5 text-violet-500" />
              <span>Privacy Shield</span>
            </div>

            {/* Account Status Pill */}
            {isConnected ? (
              <div 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                title="Account Settings & OAuth Status"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="truncate max-w-[120px] sm:max-w-[150px] font-mono">
                  {account?.email}
                </span>
              </div>
            ) : (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md transition-all cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                <span>Connect Gmail</span>
              </button>
            )}

            {/* Sync Trigger */}
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isSyncing
                  ? 'bg-violet-100 dark:bg-violet-950 text-violet-600'
                  : 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300'
              }`}
              title="Sync Inbox"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            {/* Settings Trigger */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 transition-all cursor-pointer"
              title="Settings & Setup"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'Cream Light' : 'Obsidian Dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-violet-600" />
              )}
            </button>

          </div>
        </nav>
      </header>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col lg:flex-row gap-6 pb-12">
        
        {/* Left Navigation Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0 space-y-5">
          
          {/* Primary View Switcher */}
          <div className="glass-card rounded-2xl p-3 border border-slate-200/80 dark:border-white/10 space-y-1">
            <button
              onClick={() => { setActiveTab('inbox'); setSelectedEmail(null); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'inbox'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Inbox className="w-4 h-4" />
                <span>Smart Inbox</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${activeTab === 'inbox' ? 'bg-white/20' : 'bg-slate-200 dark:bg-white/10'}`}>
                {analyticsData?.metrics?.totalEmails || emails.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('tasks'); setSelectedEmail(null); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <CheckSquare className="w-4 h-4 text-amber-500" />
                <span>Action Items & Tasks</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${activeTab === 'tasks' ? 'bg-white/20' : 'bg-slate-200 dark:bg-white/10'}`}>
                {analyticsData?.metrics?.pendingTasks || 0}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('drafts'); setSelectedEmail(null); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'drafts'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <FileEdit className="w-4 h-4 text-pink-500" />
                <span>AI Drafts & Approvals</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'drafts' ? 'bg-white/20' : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
              }`}>
                {analyticsData?.metrics?.pendingDrafts || 0} Review
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('analytics'); setSelectedEmail(null); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                <span>Email Analytics</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('logs'); setSelectedEmail(null); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-sky-500" />
                <span>Security & Audit</span>
              </div>
            </button>
          </div>

          {/* AI Category Filter Tabs (visible when in inbox view) */}
          {activeTab === 'inbox' && (
            <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-white/10 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                AI Categorization
              </span>
              <div className="space-y-1">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCategory(cat.id); setSelectedEmail(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-200/80 dark:bg-white/10 text-slate-900 dark:text-white font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strict Human-in-the-Loop Safeguard Pill */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Human Approval Guard</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              MailMind never sends, forwards, or deletes emails autonomously. Every dispatch requires explicit human confirmation.
            </p>
          </div>

        </aside>

        {/* Center Main Stage Content */}
        <main className="flex-1 space-y-6 min-w-0">
          
          {/* Metric Highlights Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="glass-card rounded-2xl p-4 transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Synced Volume</span>
                <Mail className="w-4 h-4 text-violet-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {analyticsData?.metrics?.totalEmails ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Stored in local SQLite</p>
            </div>

            <div className="glass-card rounded-2xl p-4 transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Urgent Priority</span>
                <Flame className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {analyticsData?.categories?.Urgent ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Critical triage items</p>
            </div>

            <div className="glass-card rounded-2xl p-4 transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Tasks</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {analyticsData?.metrics?.pendingTasks ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Extracted deadlines</p>
            </div>

            <div className="glass-card rounded-2xl p-4 transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Drafts to Review</span>
                <Send className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {analyticsData?.metrics?.pendingDrafts ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Awaiting human send</p>
            </div>

          </div>

          {/* Privacy & Anti-Leak Shield Banner */}
          <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-xs flex items-start space-x-3 text-slate-700 dark:text-slate-300">
            <ShieldAlert className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-slate-900 dark:text-white">Zero-Leak Sanitization Active: </span>
              Emails containing OTPs, 2FA codes, bank account details, credit cards, or medical records are automatically quarantined locally and NEVER transmitted to external LLM servers.
            </div>
          </div>

          {/* View Container */}
          {activeTab === 'inbox' && (
            selectedEmail ? (
              <EmailDetail
                email={selectedEmail}
                onBack={() => setSelectedEmail(null)}
                onSelectDraft={(draft) => setApprovalDraft(draft)}
                onDelete={handleDeleteEmail}
                onToggleTask={handleToggleTask}
                onRefreshEmail={handleSelectEmailById}
              />
            ) : (
              <EmailList
                emails={emails}
                selectedEmailId={selectedEmail?.id}
                onSelectEmail={handleSelectEmail}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                priorityFilter={priorityFilter}
                setPriorityFilter={setPriorityFilter}
                isLoading={isLoadingEmails}
              />
            )
          )}

          {activeTab === 'tasks' && (
            <TasksView onSelectEmailById={handleSelectEmailById} />
          )}

          {activeTab === 'drafts' && (
            <DraftsView onOpenApprovalModal={(draft) => setApprovalDraft(draft)} />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView />
          )}

          {activeTab === 'logs' && (
            <ActivityLogsView />
          )}

        </main>

      </div>

      {/* Human Approval Modal (Strict Human-in-the-Loop) */}
      <HumanApprovalModal
        draft={approvalDraft}
        isOpen={Boolean(approvalDraft)}
        onClose={() => setApprovalDraft(null)}
        onSent={() => {
          fetchEmails();
          fetchAnalytics();
        }}
      />

      {/* Settings & Setup Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDemoLoaded={() => {
          fetchEmails();
          fetchAnalytics();
        }}
      />

      {/* Modern SaaS Footer */}
      <footer className="border-t border-slate-200/80 dark:border-white/10 bg-slate-100/70 dark:bg-[#06070B] text-slate-500 dark:text-slate-400 py-6 text-xs text-center transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MAILMIND AI &bull; Autonomous Privacy-First Email Agent</span>
          <span>React 19 &bull; Node.js Express &bull; SQLite &bull; Google Gemini &bull; Gmail API</span>
        </div>
      </footer>

    </div>
  );
}
