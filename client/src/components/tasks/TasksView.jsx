import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  Square,
  Calendar,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  Download,
  ExternalLink,
  Edit3,
  ShieldAlert,
  X,
  Check,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { apiFetch } from '../../utils/api';

export default function TasksView({ onSelectEmailById }) {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'completed'
  const [userTimezone, setUserTimezone] = useState('Asia/Kolkata');
  const [includeFlagged, setIncludeFlagged] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Edit task date modal state
  const [editingTask, setEditingTask] = useState(null);
  const [editDueAt, setEditDueAt] = useState('');
  const [editAllDay, setEditAllDay] = useState(false);
  const [editKind, setEditKind] = useState('general');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const url = filter === 'pending'
        ? '/api/tasks?completed=0'
        : filter === 'completed'
        ? '/api/tasks?completed=1'
        : '/api/tasks';
      const res = await apiFetch(url);
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
        if (data.timezone) {
          setUserTimezone(data.timezone);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_completed: !currentStatus })
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: !currentStatus ? 1 : 0 } : t));
      }
    } catch (err) {
      console.error('Failed to toggle task', err);
    }
  };

  const handleOpenGoogleCalendar = async (taskId) => {
    try {
      const res = await apiFetch(`/api/calendar/task/${taskId}/google-url`);
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        alert(data.error || 'Unable to generate Google Calendar link for this task.');
      }
    } catch (err) {
      console.error('Failed to open Google Calendar', err);
    }
  };

  const handleDownloadTaskIcs = (taskId) => {
    window.open(`/api/calendar/task/${taskId}.ics`, '_blank');
  };

  const handleBatchExportIcs = () => {
    window.open(`/api/calendar/export.ics?scope=upcoming&includeFlagged=${includeFlagged ? 'true' : 'false'}`, '_blank');
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setEditAllDay(Boolean(task.due_all_day));
    setEditKind(task.deadline_kind || 'general');

    if (task.due_at) {
      try {
        const d = new Date(task.due_at);
        // Format for datetime-local: YYYY-MM-DDTHH:mm
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        setEditDueAt(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
      } catch (e) {
        setEditDueAt('');
      }
    } else {
      setEditDueAt('');
    }
  };

  const saveEditDate = async () => {
    if (!editingTask) return;
    setIsSavingEdit(true);

    try {
      let isoUtc = null;
      if (editDueAt) {
        const localDate = new Date(editDueAt);
        if (!isNaN(localDate.getTime())) {
          isoUtc = localDate.toISOString();
        }
      }

      const res = await apiFetch(`/api/tasks/${editingTask.id}/due`, {
        method: 'PATCH',
        body: JSON.stringify({
          due_at: isoUtc,
          due_tz: userTimezone,
          due_all_day: editAllDay ? 1 : 0,
          deadline_kind: editKind,
          deadline_text: editDueAt ? `Due: ${editDueAt.replace('T', ' ')}` : null
        })
      });

      const data = await res.json();
      if (data.success && data.task) {
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...data.task } : t));
        setEditingTask(null);
      } else {
        alert(data.error || 'Failed to update task deadline.');
      }
    } catch (err) {
      console.error('Failed to update due date', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Format dates using user timezone safely
  const formatTaskDate = (isoString, isAllDay) => {
    if (!isoString) return null;
    try {
      const dt = new Date(isoString);
      if (isNaN(dt.getTime())) return null;

      if (isAllDay) {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }).format(dt);
      }

      return new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(dt);
    } catch (e) {
      return isoString;
    }
  };

  // Group tasks into smart time buckets
  const groupedTasks = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const groups = {
      overdue: [],
      today: [],
      thisWeek: [],
      later: [],
      noDate: []
    };

    for (const t of tasks) {
      if (!t.due_at) {
        groups.noDate.push(t);
        continue;
      }

      const taskDate = new Date(t.due_at);
      if (isNaN(taskDate.getTime())) {
        groups.noDate.push(t);
        continue;
      }

      if (taskDate < todayStart && !t.is_completed) {
        groups.overdue.push(t);
      } else if (taskDate >= todayStart && taskDate < tomorrowStart) {
        groups.today.push(t);
      } else if (taskDate >= tomorrowStart && taskDate <= weekEnd) {
        groups.thisWeek.push(t);
      } else if (taskDate > weekEnd) {
        groups.later.push(t);
      } else {
        // Completed past tasks
        groups.later.push(t);
      }
    }

    return groups;
  }, [tasks]);

  const sections = [
    { key: 'overdue', title: 'Overdue Deadlines', items: groupedTasks.overdue, badgeColor: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
    { key: 'today', title: 'Due Today', items: groupedTasks.today, badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    { key: 'thisWeek', title: 'This Week', items: groupedTasks.thisWeek, badgeColor: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
    { key: 'later', title: 'Upcoming Later', items: groupedTasks.later, badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    { key: 'noDate', title: 'Action Items (No Date)', items: groupedTasks.noDate, badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <CalendarDays className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Action Items & Deadlines
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Best-effort deadline extraction. One-click export to Google Calendar or RFC 5545 .ics. Verify dates before relying.
          </p>
        </div>

        {/* Global Calendar Controls & Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-xl text-xs">
            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeFlagged}
                onChange={(e) => setIncludeFlagged(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-[11px] font-semibold">Include Flagged</span>
            </label>
          </div>

          <button
            onClick={handleBatchExportIcs}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Download all upcoming deadlines as RFC 5545 .ics calendar"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Upcoming (.ics)</span>
          </button>

          <div className="flex space-x-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filter === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filter === 'pending' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filter === 'completed' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Organizing deadlines and schedule clashes...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-slate-200/80 dark:border-white/10 space-y-3">
          <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            No action items or deadlines found
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Emails with dates, assignments, or meetings will appear here automatically with calendar sync options.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(section => {
            if (section.items.length === 0) return null;

            return (
              <div key={section.key} className="space-y-3">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {section.title}
                  </h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${section.badgeColor}`}>
                    {section.items.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {section.items.map((task) => (
                    <div
                      key={task.id}
                      className={`glass-card rounded-2xl p-4 sm:p-5 border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                        task.is_completed
                          ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70'
                          : 'border-slate-200/80 dark:border-white/10 hover:border-indigo-500/40'
                      }`}
                    >
                      {/* Left: Checkbox + Title + Metadata */}
                      <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                        <button
                          onClick={() => handleToggleTask(task.id, task.is_completed)}
                          className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer flex-shrink-0"
                          title={task.is_completed ? 'Mark pending' : 'Mark completed'}
                        >
                          {task.is_completed ? (
                            <CheckSquare className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>

                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={`text-sm font-bold truncate ${
                              task.is_completed
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-900 dark:text-white'
                            }`}>
                              {task.task_title}
                            </h4>

                            {/* Kind Badge */}
                            {task.deadline_kind && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                                {task.deadline_kind}
                              </span>
                            )}

                            {/* Clash Warning Badge */}
                            {task.is_clashing && (
                              <span
                                className="flex items-center space-x-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                title="Schedule conflict: another task is scheduled at the same time"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                <span>Schedule Clash</span>
                              </span>
                            )}

                            {/* Source Flagged Warning */}
                            {task.due_source_flagged === 1 && (
                              <span
                                className="flex items-center space-x-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/30"
                                title="Extracted from an email flagged as SUSPICIOUS by MailMind Shield"
                              >
                                <ShieldAlert className="w-3 h-3" />
                                <span>Source Flagged</span>
                              </span>
                            )}
                          </div>

                          {/* Date & Inferred Notice */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            {task.due_at ? (
                              <span className="flex items-center space-x-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                                <Calendar className="w-3 h-3" />
                                <span>{formatTaskDate(task.due_at, Boolean(task.due_all_day))}</span>
                                <span className="text-[9px] text-indigo-400 font-normal ml-1">(inferred, verify)</span>
                              </span>
                            ) : task.deadline_text ? (
                              <span className="flex items-center space-x-1 text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" />
                                <span>{task.deadline_text}</span>
                              </span>
                            ) : null}

                            {task.email_subject && (
                              <button
                                onClick={() => onSelectEmailById && onSelectEmailById(task.email_id)}
                                className="flex items-center space-x-1 text-slate-400 hover:text-indigo-500 underline decoration-dotted transition-colors truncate max-w-[280px]"
                              >
                                <span>From: "{task.email_subject}"</span>
                                <ArrowUpRight className="w-3 h-3 flex-shrink-0" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Calendar Export & Edit Actions */}
                      <div className="flex items-center space-x-1.5 flex-shrink-0 self-end md:self-center">
                        <button
                          onClick={() => openEditModal(task)}
                          className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                          title="Edit deadline or schedule"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>

                        {task.due_at && (
                          <>
                            <button
                              onClick={() => handleDownloadTaskIcs(task.id)}
                              className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                              title="Download RFC 5545 .ics file for Apple Calendar, Outlook, or mobile"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>.ics</span>
                            </button>

                            <button
                              onClick={() => handleOpenGoogleCalendar(task.id)}
                              className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                              title="Add to Google Calendar in browser (Zero extra permissions required)"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Google Cal</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Due Date Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-white/10 space-y-4 shadow-2xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Edit Task Deadline
                </h4>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  Task Title
                </label>
                <p className="font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-white/5 p-2.5 rounded-xl border border-slate-200/50 dark:border-white/5">
                  {editingTask.task_title}
                </p>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  Due Date & Time ({userTimezone})
                </label>
                <input
                  type="datetime-local"
                  value={editDueAt}
                  onChange={(e) => setEditDueAt(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="allDayCheckbox"
                  checked={editAllDay}
                  onChange={(e) => setEditAllDay(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="allDayCheckbox" className="text-slate-700 dark:text-slate-300 cursor-pointer font-semibold">
                  All-day deadline (no specific time)
                </label>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  Category / Kind
                </label>
                <select
                  value={editKind}
                  onChange={(e) => setEditKind(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="general">General Task</option>
                  <option value="assignment">Assignment / Project</option>
                  <option value="exam">Exam / Quiz / Viva</option>
                  <option value="meeting">Meeting / Sync</option>
                  <option value="payment">Payment / Fees</option>
                  <option value="submission">Document Submission</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditDate}
                disabled={isSavingEdit}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Deadline</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
