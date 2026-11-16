import React, { useState, useEffect } from 'react';
import { CheckSquare, Square, Calendar, Clock, Inbox, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function TasksView({ onSelectEmailById }) {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'completed'
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const url = filter === 'pending' ? '/api/tasks?completed=0' : filter === 'completed' ? '/api/tasks?completed=1' : '/api/tasks';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
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
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !currentStatus })
      });
      const data = await res.json();
      if (data.success) {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: !currentStatus ? 1 : 0 } : t));
      }
    } catch (err) {
      console.error('Failed to toggle task', err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Strip */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Action Items & Deadlines
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Automatically extracted by Gemini AI from incoming work correspondence and meeting invites.
          </p>
        </div>

        <div className="flex space-x-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filter === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filter === 'pending' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filter === 'completed' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Extracting action items...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-slate-200/80 dark:border-white/10 space-y-3">
          <CheckSquare className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            No action items found
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Emails with deadlines or tasks will have items extracted here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`glass-card rounded-2xl p-4 sm:p-5 border flex items-start justify-between gap-4 transition-all ${
                task.is_completed
                  ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70'
                  : 'border-slate-200/80 dark:border-white/10 hover:border-violet-500/40 hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-start space-x-3.5">
                <button
                  onClick={() => handleToggleTask(task.id, task.is_completed)}
                  className="mt-0.5 text-slate-400 hover:text-violet-600 transition-colors cursor-pointer"
                >
                  {task.is_completed ? (
                    <CheckSquare className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                <div className="space-y-1">
                  <h4 className={`text-sm font-bold ${
                    task.is_completed 
                      ? 'line-through text-slate-400 dark:text-slate-500' 
                      : 'text-slate-900 dark:text-white'
                  }`}>
                    {task.task_title}
                  </h4>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {task.deadline_text && (
                      <span className="flex items-center space-x-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        <Calendar className="w-3 h-3" />
                        <span>Deadline: {task.deadline_text}</span>
                      </span>
                    )}

                    {task.email_subject && (
                      <button
                        onClick={() => onSelectEmailById && onSelectEmailById(task.email_id)}
                        className="flex items-center space-x-1 text-slate-400 hover:text-violet-500 underline decoration-dotted transition-colors"
                      >
                        <span>From: "{task.email_subject}"</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {task.is_completed ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                  Completed
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                  Action Required
                </span>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
