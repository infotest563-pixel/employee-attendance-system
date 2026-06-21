'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { PlayCircle, StopCircle, Coffee, Clock, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { formatDateTime, minutesToHours, breakReasonLabel } from '@/lib/utils';

type WorkStatus = 'not_started' | 'working' | 'on_break' | 'clocked_out';

interface AttendanceData {
  id: number;
  login_time: string;
  logout_time: string | null;
  total_working_minutes: number;
  total_break_minutes: number;
}

interface BreakLog {
  id: number;
  break_start: string;
  break_end: string | null;
  break_reason: string;
  break_duration_minutes: number;
}

const BREAK_REASONS = [
  { value: 'lunch_break', label: '🍽️ Lunch Break' },
  { value: 'tea_break', label: '☕ Tea Break' },
  { value: 'meeting', label: '🤝 Meeting' },
  { value: 'personal_work', label: '👤 Personal Work' },
];

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<WorkStatus>('not_started');
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [breaks, setBreaks] = useState<BreakLog[]>([]);
  const [currentBreak, setCurrentBreak] = useState<BreakLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [selectedBreakReason, setSelectedBreakReason] = useState('lunch_break');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/attendance/status');
      setStatus(res.data.status);
      setAttendance(res.data.data);
      setBreaks(res.data.breaks || []);
      setCurrentBreak(res.data.currentBreak || null);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/clock-in');
      toast.success('Clocked in successfully! Have a productive day 🚀');
      fetchStatus();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to clock in');
    } finally { setActionLoading(false); }
  };

  const handleClockOut = async () => {
    if (!confirm('Are you sure you want to clock out?')) return;
    setActionLoading(true);
    try {
      const res = await api.post('/attendance/clock-out');
      toast.success(`Clocked out! Total: ${minutesToHours(res.data.total_working_minutes)} 👋`);
      fetchStatus();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to clock out');
    } finally { setActionLoading(false); }
  };

  const handleStartBreak = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/break-start', { break_reason: selectedBreakReason });
      toast.success(`Break started: ${breakReasonLabel(selectedBreakReason)}`);
      setShowBreakModal(false);
      fetchStatus();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to start break');
    } finally { setActionLoading(false); }
  };

  const handleResumeWork = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/clock-in');
      toast.success('Back to work! ✅');
      fetchStatus();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to resume');
    } finally { setActionLoading(false); }
  };

  const liveWorkingMins = (() => {
    if (!attendance?.login_time || attendance?.logout_time) return attendance?.total_working_minutes || 0;
    const totalMins = Math.floor((currentTime.getTime() - new Date(attendance.login_time).getTime()) / 60000);
    const breakMins = status === 'on_break'
      ? (attendance.total_break_minutes || 0) + Math.floor((currentTime.getTime() - new Date(currentBreak!.break_start).getTime()) / 60000)
      : (attendance.total_break_minutes || 0);
    return Math.max(0, totalMins - breakMins);
  })();

  if (loading) {
    return (
      <DashboardLayout title="My Dashboard">
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
            <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Dashboard">
      {/* Main action card */}
      <div className={`rounded-2xl p-6 md:p-8 mb-6 text-white shadow-lg transition-all ${
        status === 'working' ? 'bg-gradient-to-r from-green-600 to-green-500' :
        status === 'on_break' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
        status === 'clocked_out' ? 'bg-gradient-to-r from-gray-600 to-gray-500' :
        'bg-gradient-to-r from-blue-700 to-blue-600'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-white/70 text-sm font-medium mb-1">
              {format(currentTime, 'EEEE, MMMM d, yyyy')}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tabular-nums">
              {format(currentTime, 'hh:mm:ss a')}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`status-dot ${status === 'working' ? 'working' : status === 'on_break' ? 'break' : 'offline'}`} />
              <p className="text-white/90 text-sm font-medium capitalize">
                {status === 'not_started' && 'Not started yet'}
                {status === 'working' && 'Currently Working'}
                {status === 'on_break' && `On Break — ${breakReasonLabel(currentBreak?.break_reason || '')}`}
                {status === 'clocked_out' && 'Clocked Out'}
              </p>
            </div>
            {attendance?.login_time && (
              <p className="text-white/60 text-xs mt-1">Login: {formatDateTime(attendance.login_time)}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {status === 'not_started' && (
              <button onClick={handleClockIn} disabled={actionLoading}
                className="flex items-center gap-2 bg-white text-green-700 hover:bg-green-50 font-bold px-6 py-3 rounded-xl transition shadow-md disabled:opacity-60 text-sm">
                <PlayCircle className="w-5 h-5" />
                {actionLoading ? 'Starting...' : 'YES — Start Work'}
              </button>
            )}
            {status === 'working' && (
              <>
                <button onClick={() => setShowBreakModal(true)} disabled={actionLoading}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur text-white font-semibold px-5 py-3 rounded-xl transition text-sm">
                  <Coffee className="w-5 h-5" /> Take Break
                </button>
                <button onClick={handleClockOut} disabled={actionLoading}
                  className="flex items-center gap-2 bg-white text-red-600 hover:bg-red-50 font-bold px-6 py-3 rounded-xl transition shadow-md disabled:opacity-60 text-sm">
                  <StopCircle className="w-5 h-5" />
                  {actionLoading ? 'Stopping...' : 'NO — Stop Work'}
                </button>
              </>
            )}
            {status === 'on_break' && (
              <button onClick={handleResumeWork} disabled={actionLoading}
                className="flex items-center gap-2 bg-white text-green-700 hover:bg-green-50 font-bold px-6 py-3 rounded-xl transition shadow-md disabled:opacity-60 text-sm">
                <PlayCircle className="w-5 h-5" />
                {actionLoading ? 'Resuming...' : 'YES — Resume Work'}
              </button>
            )}
            {status === 'clocked_out' && (
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur text-white px-5 py-3 rounded-xl text-sm font-medium">
                <CheckCircle className="w-5 h-5" /> Day Complete
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Working Time</p>
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-white tabular-nums">{minutesToHours(liveWorkingMins)}</p>
          <p className="text-xs text-gray-400 mt-0.5">today</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
              <Coffee className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Break Time</p>
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-white tabular-nums">{minutesToHours(attendance?.total_break_minutes || 0)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{breaks.length} break(s)</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <PlayCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Login Time</p>
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-white tabular-nums">
            {attendance?.login_time ? format(new Date(attendance.login_time), 'hh:mm a') : '--:--'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">today</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
              <StopCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Logout Time</p>
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-white tabular-nums">
            {attendance?.logout_time ? format(new Date(attendance.logout_time), 'hh:mm a') : '--:--'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">today</p>
        </div>
      </div>

      {/* Break Log */}
      {breaks.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Coffee className="w-4 h-4 text-yellow-500" /> Today's Breaks
            </h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {breaks.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center text-sm">
                    {b.break_reason === 'lunch_break' ? '🍽️' : b.break_reason === 'tea_break' ? '☕' : b.break_reason === 'meeting' ? '🤝' : '👤'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{breakReasonLabel(b.break_reason)}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(b.break_start), 'hh:mm a')}
                      {b.break_end ? ` → ${format(new Date(b.break_end), 'hh:mm a')}` : ' → ongoing'}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {b.break_end ? minutesToHours(b.break_duration_minutes) : <span className="text-yellow-500 text-xs animate-pulse">● Active</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Break Reason Modal */}
      {showBreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowBreakModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select Break Reason</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">What type of break are you taking?</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {BREAK_REASONS.map((r) => (
                <button key={r.value} onClick={() => setSelectedBreakReason(r.value)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition text-left ${selectedBreakReason === r.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowBreakModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
              <button onClick={handleStartBreak} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium transition disabled:opacity-60">
                {actionLoading ? 'Starting...' : 'Start Break'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
