'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  FileSpreadsheet, FileText, Calendar, BarChart2,
  Download, RefreshCw, Clock, Coffee
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { formatDate, minutesToHours } from '@/lib/utils';

interface MonthlySummary {
  employee_id: string;
  first_name: string;
  last_name: string;
  department: string;
  days_present: number;
  total_hours: number;
  avg_hours_per_day: number;
  total_break_minutes: number;
}

interface DailyRecord {
  employee_id: string;
  first_name: string;
  last_name: string;
  date: string;
  login_time: string;
  logout_time: string;
  status: string;
  total_working_minutes: number;
  total_break_minutes: number;
}

export default function ReportsPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'weekly'>('daily');
  const [dailyDate, setDailyDate] = useState(today);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [weekStart, setWeekStart] = useState(today);
  const [loading, setLoading] = useState(false);
  const [dailyData, setDailyData] = useState<DailyRecord[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ data: DailyRecord[]; summary: MonthlySummary[] } | null>(null);
  const [exportFrom, setExportFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exportTo, setExportTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

  const fetchDaily = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/daily?date=${dailyDate}`);
      setDailyData(res.data.data);
    } catch { toast.error('Failed to load daily report'); }
    finally { setLoading(false); }
  };

  const fetchMonthly = async () => {
    setLoading(true);
    try {
      const [y, m] = month.split('-');
      const res = await api.get(`/reports/monthly?year=${y}&month=${m}`);
      setMonthlyData(res.data);
    } catch { toast.error('Failed to load monthly report'); }
    finally { setLoading(false); }
  };

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${process.env.NEXT_PUBLIC_API_URL}/reports/export/${type}?from=${exportFrom}&to=${exportTo}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `attendance_${exportFrom}_${exportTo}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${type.toUpperCase()} exported successfully`);
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const statusBg = (status: string) => {
    const m: Record<string, string> = {
      present: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      absent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      half_day: 'bg-yellow-100 text-yellow-700',
      on_leave: 'bg-blue-100 text-blue-700',
    };
    return m[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <DashboardLayout title="Reports">
      {/* Export Panel */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-blue-600" /> Export Reports
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From Date</label>
            <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To Date</label>
            <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={() => handleExport('excel')} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl text-sm font-medium transition">
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <button onClick={() => handleExport('pdf')} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-medium transition">
            <FileText className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6 w-fit">
        {(['daily', 'monthly', 'weekly'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${activeTab === tab ? 'bg-white dark:bg-gray-900 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Daily Report */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
              <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={fetchDaily} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Generate
            </button>
          </div>

          {dailyData.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" /> Daily Report — {formatDate(dailyDate)}
                </h3>
                <span className="text-sm text-gray-500">{dailyData.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      {['Employee', 'Login', 'Logout', 'Working', 'Break', 'Status'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((r, i) => (
                      <tr key={i} className="table-row-hover border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{r.first_name} {r.last_name}</p>
                          <p className="text-xs text-gray-400">{r.employee_id}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{r.login_time ? format(new Date(r.login_time), 'hh:mm a') : '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{r.logout_time ? format(new Date(r.logout_time), 'hh:mm a') : <span className="text-green-500 text-xs">● Active</span>}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">{minutesToHours(r.total_working_minutes)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{minutesToHours(r.total_break_minutes)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBg(r.status)}`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monthly Report */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Month</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={fetchMonthly} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Generate
            </button>
          </div>

              {monthlyData && monthlyData.summary && monthlyData.summary.length > 0 && (
                <div className="space-y-5">
                  {/* Summary cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monthlyData.summary.map((s, i) => (
                      <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-semibold">
                            {(s.first_name?.[0] || '?')}{(s.last_name?.[0] || '?')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.first_name} {s.last_name}</p>
                            <p className="text-xs text-gray-400">{s.department || '-'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                            <p className="text-lg font-bold text-green-700 dark:text-green-400">{s.days_present ?? 0}</p>
                            <p className="text-xs text-gray-500">Days Present</p>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{s.total_hours ?? 0}h</p>
                            <p className="text-xs text-gray-500">Total Hours</p>
                          </div>
                          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{s.avg_hours_per_day ?? 0}h</p>
                            <p className="text-xs text-gray-500">Avg/Day</p>
                          </div>
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2">
                            <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{minutesToHours(s.total_break_minutes)}</p>
                            <p className="text-xs text-gray-500">Total Break</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {monthlyData && (!monthlyData.summary || monthlyData.summary.length === 0) && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center text-gray-400 shadow-sm">
                  No attendance records found for this month.
                </div>
              )}
        </div>
      )}

      {/* Weekly Report */}
      {activeTab === 'weekly' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Week Starting</label>
              <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={async () => {
              setLoading(true);
              try {
                const res = await api.get(`/reports/weekly?week_start=${weekStart}`);
                setDailyData(res.data.data);
              } catch { toast.error('Failed to load weekly report'); }
              finally { setLoading(false); }
            }} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Generate
            </button>
          </div>
          {dailyData.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold text-gray-800 dark:text-white">Weekly Report — {dailyData.length} records</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      {['Employee', 'Date', 'Login', 'Logout', 'Working', 'Status'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((r, i) => (
                      <tr key={i} className="table-row-hover border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{r.first_name} {r.last_name}</p>
                          <p className="text-xs text-gray-400">{r.employee_id}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatDate(r.date)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{r.login_time ? format(new Date(r.login_time), 'hh:mm a') : '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{r.logout_time ? format(new Date(r.logout_time), 'hh:mm a') : '-'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">{minutesToHours(r.total_working_minutes)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBg(r.status)}`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
