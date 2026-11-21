import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  Calendar,
  Clock,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Download,
  Trash2,
  ArrowUpRight,
  ShieldAlert,
  DollarSign,
  Briefcase,
  Award,
  Filter
} from 'lucide-react';
import { apiFetch } from '../../utils/api';

export default function CampusView({ onSelectEmailById, onOpenSettings }) {
  const [items, setItems] = useState([]);
  const [selectedKind, setSelectedKind] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [userTimezone, setUserTimezone] = useState('Asia/Kolkata');

  const fetchCampusItems = async () => {
    try {
      setIsLoading(true);
      const url = selectedKind !== 'all' ? `/api/campus/items?kind=${selectedKind}` : '/api/campus/items';
      const res = await apiFetch(url);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch campus items', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampusItems();
  }, [selectedKind]);

  // Also fetch user timezone
  useEffect(() => {
    apiFetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.settings?.timezone) {
          setUserTimezone(d.settings.timezone);
        }
      })
      .catch(() => {});
  }, []);

  const handleDeleteItem = async (itemId) => {
    try {
      const res = await apiFetch(`/api/campus/items/${itemId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.filter(i => i.id !== itemId));
      }
    } catch (err) {
      console.error('Failed to delete campus item', err);
    }
  };

  const handleExportIcs = () => {
    window.open('/api/campus/export.ics', '_blank');
  };

  const formatDate = (isoString, isAllDay) => {
    if (!isoString) return 'No deadline specified';
    try {
      const dt = new Date(isoString);
      if (isNaN(dt.getTime())) return isoString;

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

  // Group items by week or time bucket
  const { thisWeekCount, topUpcoming, groupedByCourse } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    let thisWeek = 0;
    const upcomingWithDate = [];

    const coursesMap = {};

    for (const item of items) {
      const courseKey = item.course || 'General Academic';
      if (!coursesMap[courseKey]) {
        coursesMap[courseKey] = [];
      }
      coursesMap[courseKey].push(item);

      if (item.due_at) {
        const itemDate = new Date(item.due_at);
        if (!isNaN(itemDate.getTime())) {
          if (itemDate >= todayStart && itemDate <= weekEnd) {
            thisWeek++;
          }
          if (itemDate >= todayStart) {
            upcomingWithDate.push(item);
          }
        }
      }
    }

    upcomingWithDate.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

    return {
      thisWeekCount: thisWeek,
      topUpcoming: upcomingWithDate.slice(0, 3),
      groupedByCourse: coursesMap
    };
  }, [items]);

  const kindOptions = [
    { key: 'all', label: 'All Milestones' },
    { key: 'assignment', label: 'Assignments' },
    { key: 'exam', label: 'Exams & Quizzes' },
    { key: 'fee', label: 'Fee Notices' },
    { key: 'placement', label: 'Placements' },
    { key: 'event', label: 'Events' }
  ];

  const getKindIcon = (kind) => {
    switch (kind) {
      case 'assignment':
        return <BookOpen className="w-3.5 h-3.5 text-blue-500" />;
      case 'exam':
        return <GraduationCap className="w-3.5 h-3.5 text-rose-500" />;
      case 'fee':
      case 'scholarship':
        return <DollarSign className="w-3.5 h-3.5 text-amber-500" />;
      case 'placement':
        return <Briefcase className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Award className="w-3.5 h-3.5 text-violet-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Campus Mode: Semester Timeline
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Automated intelligence for assignments, exam dates, college fees, and placements. Best-effort heuristic extraction — verify on official college portal before relying.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportIcs}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Download semester deadlines as RFC 5545 .ics calendar"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Campus (.ics)</span>
          </button>
        </div>
      </div>

      {/* "This Week" Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 flex items-center space-x-4 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {thisWeekCount}
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Deadlines This Week
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 md:col-span-2 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Next Urgent Milestones
          </span>
          {topUpcoming.length === 0 ? (
            <p className="text-xs text-slate-400">No upcoming milestones with confirmed due dates.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topUpcoming.map(u => (
                <div
                  key={u.id}
                  className="flex items-center space-x-2 bg-slate-100 dark:bg-white/5 px-2.5 py-1.5 rounded-xl text-xs border border-slate-200/60 dark:border-white/5"
                >
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                    {u.title}
                  </span>
                  <span className="text-[10px] text-indigo-500 font-semibold">
                    {formatDate(u.due_at, Boolean(u.all_day))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kind Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl w-fit text-xs">
        {kindOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSelectedKind(opt.key)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              selectedKind === opt.key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Main Timeline List */}
      {isLoading ? (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Syncing semester timeline items...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-slate-200/80 dark:border-white/10 space-y-3">
          <GraduationCap className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            No campus milestones found
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Emails from college domains (or with terms like assignments, midsem, fee notices) will be automatically categorized here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByCourse).map(([courseName, courseItems]) => (
            <div key={courseName} className="space-y-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {courseName}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500">
                  {courseItems.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {courseItems.map(item => (
                  <div
                    key={item.id}
                    className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-white/10 hover:border-indigo-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5">
                          {getKindIcon(item.kind)}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </h4>

                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                          {item.kind}
                        </span>

                        {/* SENDER TRUST MEMORY SAFETY BADGE */}
                        {item.trust_label?.includes('verify') ? (
                          <span
                            className="flex items-center space-x-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse"
                            title="Sensitive ask from unknown or unverified sender. Verify through official university portal before paying or submitting documents."
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>Official portal se verify karo</span>
                          </span>
                        ) : item.trust_label === 'Trusted Campus Source' ? (
                          <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Trusted Source</span>
                          </span>
                        ) : null}

                        {/* SOURCE SHIELD WARNING */}
                        {item.source_flagged === 1 && (
                          <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Source Flagged</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {item.due_at && (
                          <span className="flex items-center space-x-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(item.due_at, Boolean(item.all_day))}</span>
                          </span>
                        )}

                        {item.email_subject && (
                          <button
                            onClick={() => onSelectEmailById && onSelectEmailById(item.email_id)}
                            className="flex items-center space-x-1 text-slate-400 hover:text-indigo-500 underline decoration-dotted transition-colors truncate max-w-[260px]"
                          >
                            <span>From: "{item.email_subject}"</span>
                            <ArrowUpRight className="w-3 h-3 flex-shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end md:self-center flex-shrink-0">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Dismiss campus item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
