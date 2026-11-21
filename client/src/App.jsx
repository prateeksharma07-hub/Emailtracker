import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { apiFetch } from './utils/api';
import LoginView from './components/auth/LoginView';
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
  LogOut,
  HelpCircle,
  Check,
  ChevronRight,
  Fingerprint,
  FlaskConical,
  Bot
} from 'lucide-react';

import EmailList from './components/inbox/EmailList';
import EmailDetail from './components/inbox/EmailDetail';
import HumanApprovalModal from './components/drafts/HumanApprovalModal';
import DraftsView from './components/drafts/DraftsView';
import TasksView from './components/tasks/TasksView';
import CheckpointView from './components/checkpoint/CheckpointView';
import AutopilotView from './components/autopilot/AutopilotView';
import AttackLabView from './components/lab/AttackLabView';
import AnalyticsView from './components/analytics/AnalyticsView';
import ActivityLogsView from './components/logs/ActivityLogsView';
import SettingsModal from './components/settings/SettingsModal';

export default function App() {
  const { 
    user,
    account, 
    isAuthenticated,
    isLoading,
    isSyncing, 
    syncStatus, 
    lastSyncedAt, 
    authNotification, 
    clearAuthNotification, 
    triggerSync, 
    connectGmail, 
    logout,
    deleteAccountData 
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
  const [checkpointEmailId, setCheckpointEmailId] = useState(null);

  // Fetch Emails with active filters & pagination strictly for authenticated user
  const fetchEmails = useCallback(async () => {
    if (!isAuthenticated) return;
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

      const res = await apiFetch(`/api/emails?${params.toString()}`);
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
  }, [selectedCategory, priorityFilter, searchQuery, currentPage, isAuthenticated]);

  // Fetch Analytics Overview
  const fetchAnalytics = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/analytics');
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEmails();
    }
  }, [fetchEmails, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, isAuthenticated]);

  // Reset pagination on user switch
  useEffect(() => {
    if (isAuthenticated) {
      setCurrentPage(1);
      setSelectedEmail(null);
      fetchEmails();
      fetchAnalytics();
    }
  }, [user?.id, isAuthenticated]);

  const handleSelectEmail = async (emailSummary) => {
    try {
      const res = await apiFetch(`/api/emails/${emailSummary.id}`);
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

  const handleInspectCheckpoint = (emailId) => {
    setCheckpointEmailId(emailId);
    setActiveTab('checkpoint');
    setSelectedEmail(null);
  };

  const handleDeleteEmail = async (emailId) => {
    try {
      await apiFetch(`/api/emails/${emailId}`, { method: 'DELETE' });
      setSelectedEmail(null);
      fetchEmails();
      fetchAnalytics();
    } catch (err) {
      console.error('Failed to delete email', err);
    }
  };

  const handleToggleTask = async (taskId, nextStatus) => {
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
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
    const res = await triggerSync(opts || { maxResults: 30 });
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

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 mb-4 animate-pulse">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm font-semibold tracking-wide">Initializing MailMind AI...</p>
        <p className="text-xs text-slate-500 mt-1 font-mono">Verifying encrypted session</p>
      </div>
    );
  }

  // Unauthenticated State: Show Dedicated Google Login View
  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

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
      case 'autopilot': return 'Autopilot & Reply Intelligence';
      case 'tasks': return 'Action Items & Deadlines';
      case 'drafts': return 'AI Response Studio';
      case 'checkpoint': return 'AI Firewall Checkpoint (X-Ray)';
      case 'lab': return 'Adversarial Attack & Simulation Lab';
      case 'analytics': return 'Intelligence & Metrics';
      case 'logs': return 'Security & Audit Logs';
      default: return 'MailMind AI';
    }
  };

  const getScreenSubtitle = () => {
    switch (activeTab) {
      case 'inbox': return 'Live categorized correspondence with automatic AI summaries';
      case 'autopilot': return 'Needs-reply triage, 3-tone adaptive response drafting, and follow-up tracking';
      case 'tasks': return 'Actionable deadlines extracted by Groq AI from incoming emails';
      case 'drafts': return 'Prepared response drafts awaiting human authorization';
      case 'checkpoint': return 'Real-time steganographic payload inspection and prompt injection defense terminal';
      case 'lab': return 'Interactive prompt-injection simulation comparing Naive AI vs MailMind Shield';
      case 'analytics': return 'Comprehensive email volume, priority matrix, and AI efficiency';
      case 'logs': return 'Zero-leak data sanitization and local audit trail';
      default: return '';
    }
  };

  const currentUser = user || account;

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

            {/* Quick Theme Switcher */}
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
              onClick={() => { setActiveTab('autopilot'); setSelectedEmail(null); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'autopilot'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Bot className="w-4 h-4 text-violet-400" />
                <span>Autopilot Engine</span>
              </div>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                activeTab === 'autopilot' ? 'bg-white/20' : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
              }`}>
                Auto
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
              onClick={() => { setActiveTab('checkpoint'); setSelectedEmail(null); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'checkpoint'
                  ? 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Fingerprint className="w-4 h-4 text-cyan-400" />
                <span>Checkpoint (X-Ray)</span>
              </div>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                activeTab === 'checkpoint' ? 'bg-white/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              }`}>
                Shield
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('lab'); setSelectedEmail(null); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'lab'
                  ? 'bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-md shadow-amber-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <FlaskConical className="w-4 h-4 text-amber-400" />
                <span>Attack Lab</span>
              </div>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                activeTab === 'lab' ? 'bg-white/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                Lab
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
              {currentUser?.picture ? (
                <img 
                  src={currentUser.picture} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full border border-violet-500 flex-shrink-0" 
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                  {(currentUser?.name || currentUser?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {currentUser?.name || 'Gmail User'}
                </p>
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-slate-400 font-mono truncate">
                    {currentUser?.email}
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
            <span className="font-mono text-[10px] text-slate-500">v2.0 Multi-User</span>
          </div>

        </div>

      </aside>

      {/* Main Screen Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Top Header Bar */}
        <header className="px-4 sm:px-8 py-4 border-b border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-[#0A0C13]/60 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {getScreenTitle()}
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              {getScreenSubtitle()}
            </p>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* User Profile Pill */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono truncate max-w-[180px]">{currentUser?.email}</span>
            </div>

            {/* Sync Button */}
            <button
              onClick={() => handleTriggerSync()}
              disabled={isSyncing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 shadow-xs cursor-pointer disabled:opacity-50"
              title="Sync recent emails from Gmail"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Theme Toggle */}
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

            {/* Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile Tab Switcher */}
        <div className="md:hidden flex items-center space-x-1 p-2 bg-slate-100 dark:bg-white/5 overflow-x-auto border-b border-slate-200 dark:border-white/10">
          {[
            { id: 'inbox', label: 'Inbox' },
            { id: 'autopilot', label: 'Autopilot' },
            { id: 'tasks', label: 'Tasks' },
            { id: 'drafts', label: 'Drafts' },
            { id: 'checkpoint', label: 'Firewall' },
            { id: 'lab', label: 'Attack Lab' },
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
                onInspectCheckpoint={handleInspectCheckpoint}
              />
            ) : (
              <EmailList
                emails={emails}
                selectedEmailId={selectedEmail?.id}
                onSelectEmail={handleSelectEmail}
                onInspectCheckpoint={handleInspectCheckpoint}
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
                isConnected={isAuthenticated}
                onConnectGmail={connectGmail}
              />
            )
          )}

          {/* SCREEN: AUTOPILOT ENGINE */}
          {activeTab === 'autopilot' && (
            <AutopilotView
              onOpenApprovalModal={(draft) => setApprovalDraft(draft)}
              onInspectCheckpoint={handleInspectCheckpoint}
            />
          )}

          {/* SCREEN 2: TASKS & DEADLINES */}
          {activeTab === 'tasks' && (
            <TasksView onSelectEmailById={handleSelectEmailById} />
          )}

          {/* SCREEN 3: AI DRAFTS & APPROVALS */}
          {activeTab === 'drafts' && (
            <DraftsView onOpenApprovalModal={(draft) => setApprovalDraft(draft)} />
          )}

          {/* SCREEN 4: AI FIREWALL CHECKPOINT & X-RAY */}
          {activeTab === 'checkpoint' && (
            <CheckpointView
              initialEmailId={checkpointEmailId}
              onSelectEmailById={handleSelectEmailById}
            />
          )}

          {/* SCREEN: ATTACK LAB SIMULATION */}
          {activeTab === 'lab' && (
            <AttackLabView />
          )}

          {/* SCREEN 5: EMAIL ANALYTICS & INTELLIGENCE */}
          {activeTab === 'analytics' && (
            <AnalyticsView />
          )}

          {/* SCREEN 6: SECURITY & AUDIT LOGS */}
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
