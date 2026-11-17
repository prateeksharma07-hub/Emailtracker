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
  X,
  AlertCircle,
  HelpCircle,
  Check,
  ChevronRight
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
  const { 
    account, 
    isConnected, 
    isDemoMode, 
    isLiveMode, 
    isSyncing, 
    syncStatus, 
    lastSyncedAt, 
    authNotification, 
    clearAuthNotification, 
    triggerSync, 
    connectGmail, 
    disconnectAccount 
  } = useAuth();
  
  const { theme, toggleTheme } = useTheme();

  // Navigation & View States
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'tasks' | 'drafts' | 'analytics' | 'logs'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Data States
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isLoadingEmails, setIsLoadingEmails] = useState(true);
  const [approvalDraft, setApprovalDraft] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Fetch Emails with active filters & pagination
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
      params.append('page', currentPage.toString());
      params.append('limit', '20');

      const res = await fetch(`/api/emails?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch emails', err);
    } finally {
      setIsLoadingEmails(false);
    }
  }, [selectedCategory, priorityFilter, searchQuery, currentPage, account]);

  // Fetch Analytics Overview
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
  }, [account]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Automatic refresh on account connect / disconnect
  useEffect(() => {
    setCurrentPage(1);
    setSelectedEmail(null);
    fetchEmails();
    fetchAnalytics();
  }, [account]);

  const handleSelectEmail = async (emailSummary) => {
    try {
      const res = await fetch(`/api/emails/${emailSummary.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedEmail(data.email);
        fetchEmails(); // Update unread status
      }
    } catch (err) {
      console.error('Failed to load email detail', err);
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

  const handleTriggerSync = async (opts) => {
    setCurrentPage(1);
    const res = await triggerSync(opts || { maxResults: 50 });
    fetchEmails();
    fetchAnalytics();
    return res;
  };

  const handleCategoryChange = (catId) => {
    setSelectedCategory(catId);
    setCurrentPage(1);
    setSelectedEmail(null);
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handlePriorityChange = (priority) => {
    setPriorityFilter(priority);
    setCurrentPage(1);
  };

  const categories = [
    { id: 'all', label: 'All', icon: Inbox, count: analyticsData?.metrics?.totalEmails || pagination.total },
    { id: 'Urgent', label: 'Urgent', icon: Flame, count: analyticsData?.categories?.Urgent || 0 },
    { id: 'Work', label: 'Work', icon: Briefcase, count: analyticsData?.categories?.Work || 0 },
    { id: 'Meeting', label: 'Meetings', icon: Calendar, count: analyticsData?.categories?.Meeting || 0 },
    { id: 'Task', label: 'Tasks', icon: CheckSquare, count: analyticsData?.categories?.Task || 0 },
    { id: 'Personal', label: 'Personal', icon: UserCheck, count: analyticsData?.categories?.Personal || 0 },
    { id: 'Newsletter', label: 'Newsletters', icon: Newspaper, count: analyticsData?.categories?.Newsletter || 0 },
  ];

  const getScreenTitle = () => {
    switch (activeTab) {
      case 'inbox': return 'Smart Inbox';
      case 'tasks': return 'Action Items & Deadlines';
      case 'drafts': return 'AI Response Studio';
      case 'analytics': return 'Intelligence & Metrics';
      case 'logs': return 'Security & Audit Logs';
      default: return 'MailMind AI';
    }
  };

  const getScreenSubtitle = () => {
    switch (activeTab) {
      case 'inbox': return 'Live categorized correspondence with automatic AI summaries';
      case 'tasks': return 'Actionable deadlines extracted by Groq AI from incoming emails';
      case 'drafts': return 'Prepared response drafts awaiting human authorization';
      case 'analytics': return 'Comprehensive email volume, priority matrix, and AI efficiency';
      case 'logs': return 'Zero-leak data sanitization and local audit trail';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0C13] text-slate-900 dark:text-slate-100 flex font-sans transition-colors duration-200">
      
      {/* Sleek Dedicated Left Sidebar */}
      <aside className="w-64 border-r border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0E111A]/90 backdrop-blur-xl flex flex-col justify-between flex-shrink-0 z-30 min-h-screen sticky top-0 hidden md:flex">
        
        {/* Top: Brand & Main Navigation */}
        <div className="p-4 space-y-6">
          
          {/* Brand Mark & Top Theme Toggle */}
          <div className="flex items-center justify-between px-2 py-1 select-none">
            <div 
              onClick={() => { setActiveTab('inbox'); setSelectedEmail(null); }}
              className="flex items-center space-x-2.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-amber-400 p-[1.5px] shadow-md shadow-violet-500/20 flex-shrink-0 group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-amber-300" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                    MAILMIND
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-violet-600 text-white shadow-xs">
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Autonomous Email Agent
                </p>
              </div>
            </div>

            {/* Quick Theme Switcher next to MailMind AI */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer shadow-xs"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Obsidian Dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-violet-600" />
              )}
            </button>
          </div>

          {/* Dedicated Section Tabs */}
          <nav className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-2">
              Workspace Views
            </span>

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
                {analyticsData?.metrics?.totalEmails || pagination.total}
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
                <span>Tasks & Deadlines</span>
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
                {analyticsData?.metrics?.pendingDrafts || 0}
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
          </nav>
        </div>

        {/* Bottom: User Card & Global Actions */}
        <div className="p-4 border-t border-slate-200/80 dark:border-white/10 space-y-3">
          
          {/* User Account Capsule */}
          <div 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Account & Settings"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              {account?.picture ? (
                <img 
                  src={account.picture} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full border border-violet-500 flex-shrink-0" 
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                  {(account?.name || account?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {account?.name || 'Gmail User'}
                </p>
                <div className="flex items-center space-x-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className="text-[10px] text-slate-400 font-mono truncate">
                    {isLiveMode ? 'Live Gmail' : 'Demo Mode'}
                  </span>
                </div>
              </div>
            </div>

            <Settings className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0" />
          </div>

          {/* Engine Status Pill */}
          <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Groq LPU Active</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">v1.0</span>
          </div>

        </div>

      </aside>

      {/* Main Screen Container (100% Dedicated per Tab) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Top Floating Mobile / Tablet Bar */}
        <header className="px-4 sm:px-8 py-4 border-b border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-[#0A0C13]/60 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {getScreenTitle()}
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              {getScreenSubtitle()}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {isLiveMode ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono">{account.email}</span>
              </span>
            ) : (
              <button
                onClick={connectGmail}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 shadow-xs cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                <span>Connect Live Gmail</span>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer border border-slate-200/60 dark:border-white/10"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Obsidian Dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-violet-600" />
              )}
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile Tab Switcher */}
        <div className="md:hidden flex items-center space-x-1 p-2 bg-slate-100 dark:bg-white/5 overflow-x-auto border-b border-slate-200 dark:border-white/10">
          {[
            { id: 'inbox', label: 'Inbox' },
            { id: 'tasks', label: 'Tasks' },
            { id: 'drafts', label: 'Drafts' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'logs', label: 'Audit' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setSelectedEmail(null); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Dedicated Screen Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">
          
          {/* Notifications */}
          {authNotification && (
            <div className={`p-4 rounded-2xl text-xs flex items-center justify-between border mb-6 ${
              authNotification.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            }`}>
              <div className="flex items-center space-x-2">
                {authNotification.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                )}
                <span className="font-semibold">{authNotification.message}</span>
              </div>
              <button
                onClick={clearAuthNotification}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* SCREEN 1: SMART INBOX */}
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
                setSearchQuery={handleSearchChange}
                priorityFilter={priorityFilter}
                setPriorityFilter={handlePriorityChange}
                selectedCategory={selectedCategory}
                setSelectedCategory={handleCategoryChange}
                categories={categories}
                isLoading={isLoadingEmails}
                pagination={pagination}
                onPageChange={(p) => setCurrentPage(p)}
                onTriggerSync={handleTriggerSync}
                isSyncing={isSyncing}
                isConnected={isConnected}
                onConnectGmail={connectGmail}
              />
            )
          )}

          {/* SCREEN 2: TASKS & DEADLINES */}
          {activeTab === 'tasks' && (
            <TasksView onSelectEmailById={handleSelectEmailById} />
          )}

          {/* SCREEN 3: AI DRAFTS & APPROVALS */}
          {activeTab === 'drafts' && (
            <DraftsView onOpenApprovalModal={(draft) => setApprovalDraft(draft)} />
          )}

          {/* SCREEN 4: EMAIL ANALYTICS & INTELLIGENCE */}
          {activeTab === 'analytics' && (
            <AnalyticsView />
          )}

          {/* SCREEN 5: SECURITY & AUDIT LOGS */}
          {activeTab === 'logs' && (
            <ActivityLogsView />
          )}

        </main>
      </div>

      {/* Human Approval Modal */}
      {approvalDraft && (
        <HumanApprovalModal
          draft={approvalDraft}
          isOpen={Boolean(approvalDraft)}
          onClose={() => setApprovalDraft(null)}
          onSent={() => {
            fetchEmails();
            fetchAnalytics();
            if (selectedEmail) handleSelectEmail(selectedEmail);
          }}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDemoLoaded={() => {
          fetchEmails();
          fetchAnalytics();
        }}
      />

    </div>
  );
}
