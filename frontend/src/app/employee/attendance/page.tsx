'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { History, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { formatDate, formatDateTime, minutesToHours, statusColor } from '@/lib/utils';

interface AttendanceRecord {
  id: number;
  date: string;
  login_time: string;
  logout_time: string;
  status: string;
  total_working_minutes: number;
  total_break_minutes: number;
  working_hours_formatted: string;
  notes: string;
  is_corrected: number;
}

export default function MyAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/my-history?from=${from}&to=${to}&page=${page}&limit=${limit}`);
      setRecords(res.data.data);
      setTotal(res.data.pagination.total);
    } catch { toast.error('Failed to load attendance history'); }
    finally { setLoading(false); }
  }, [from, to, page]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Summary stats
  const totalDays = records.length;
  const totalWorkingMins = records.reduce((a, r) => a + (r.total_working_minutes || 0), 0);
  const totalBreakMins = records.reduce((a, r) => a + (r.total_break_minutes || 0), 0);
  const avgMins = totalDays > 0 ? Math.floor(totalWorkingMins / totalDays) : 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <DashboardLayout title="My Attendance">
      {/* Summary */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Days Present', value: totalDays, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
            { label: 'Total Hours', value: minutesToHours(totalWorkingMins), color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Avg Daily Hours', value: minutesToHours(avgMins), color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
            { label: 'Total Break Time', value: minutesToHours(totalBreakMins), color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm ${s.bg}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 mb-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400">
            <Filter className="w-4 h-4" /> Filter
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From</label>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={() => { setFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setTo(format(endOfMonth(new Date()), 'yyyy-MM-dd')); setPage(1); }}
            className="px-3 py-2 text-xs text-blue-600 hover:underline">This Month</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-gray-800 dark:text-white">Attendance History</h2>
          <span className="ml-auto text-sm text-gray-400">{total} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {['Date', 'Login Time', 'Logout Time', 'Working Hours', 'Break Time', 'Status', 'Notes'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No attendance records found
                  </td>
                </tr>
              ) : records.map((rec) => (
                <tr key={rec.id} className="table-row-hover border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatDate(rec.date)}</p>
                    <p className="text-xs text-gray-400">{format(new Date(rec.date), 'EEE')}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{rec.login_time ? formatDateTime(rec.login_time) : '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {rec.logout_time ? formatDateTime(rec.logout_time) : <span className="text-green-500 text-xs font-medium">● Active</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{minutesToHours(rec.total_working_minutes)}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{minutesToHours(rec.total_break_minutes)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor(rec.status)}`}>
                      {rec.status?.replace('_', ' ')}
                    </span>
                    {rec.is_corrected ? <span className="ml-1 text-xs text-orange-400" title="Manually corrected by admin">✎</span> : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">{rec.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
