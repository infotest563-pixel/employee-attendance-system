'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Search, Filter, Edit, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { formatDate, formatDateTime, minutesToHours, statusColor } from '@/lib/utils';
import { format } from 'date-fns';

interface AttendanceRecord {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  department: string;
  date: string;
  login_time: string;
  logout_time: string;
  status: string;
  total_working_minutes: number;
  total_break_minutes: number;
  working_hours_formatted: string;
  break_time_formatted: string;
  is_corrected: number;
  notes: string;
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [correctForm, setCorrectForm] = useState({ login_time: '', logout_time: '', status: 'present', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: String(limit),
        ...(search && { employee_id: search.toUpperCase() }),
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await api.get(`/attendance/all?${params}`);
      setRecords(res.data.data);
      setTotal(res.data.pagination.total);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  }, [page, search, fromDate, toDate, statusFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openCorrect = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setCorrectForm({
      login_time: record.login_time ? record.login_time.slice(0, 16) : '',
      logout_time: record.logout_time ? record.logout_time.slice(0, 16) : '',
      status: record.status,
      notes: record.notes || '',
    });
    setShowCorrectModal(true);
  };

  const handleCorrect = async () => {
    if (!selectedRecord) return;
    setSaving(true);
    try {
      await api.put(`/attendance/${selectedRecord.id}/correct`, correctForm);
      toast.success('Attendance corrected successfully');
      setShowCorrectModal(false);
      fetchRecords();
    } catch { toast.error('Failed to correct attendance'); }
    finally { setSaving(false); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <DashboardLayout title="Attendance Records">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Employee ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="half_day">Half Day</option>
            <option value="on_leave">On Leave</option>
          </select>
          <button onClick={fetchRecords} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Employee</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden sm:table-cell">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden md:table-cell">Login</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden md:table-cell">Logout</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden lg:table-cell">Working</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden lg:table-cell">Break</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No records found</td></tr>
              ) : records.map((rec) => (
                <tr key={rec.id} className="table-row-hover border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {rec.first_name?.[0]}{rec.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{rec.first_name} {rec.last_name}</p>
                        <p className="text-xs text-gray-400">{rec.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-gray-600 dark:text-gray-400">{formatDate(rec.date)}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-600 dark:text-gray-400">{rec.login_time ? formatDateTime(rec.login_time) : '-'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-600 dark:text-gray-400">
                    {rec.logout_time ? formatDateTime(rec.logout_time) : <span className="text-green-500 text-xs font-medium">● Active</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-700 dark:text-gray-300 font-medium">{minutesToHours(rec.total_working_minutes)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-600 dark:text-gray-400">{minutesToHours(rec.total_break_minutes)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor(rec.status)}`}>
                      {rec.status.replace('_', ' ')}
                    </span>
                    {rec.is_corrected ? <span className="ml-1 text-xs text-orange-500" title="Manually corrected">✎</span> : null}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex justify-end">
                      <button onClick={() => openCorrect(rec)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Correct Attendance">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-500">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Correct Attendance Modal */}
      <Modal isOpen={showCorrectModal} onClose={() => setShowCorrectModal(false)} title="Correct Attendance" size="md">
        {selectedRecord && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-400">
              Editing: <strong>{selectedRecord.first_name} {selectedRecord.last_name}</strong> on <strong>{formatDate(selectedRecord.date)}</strong>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Login Time</label>
              <input type="datetime-local" value={correctForm.login_time} onChange={e => setCorrectForm({ ...correctForm, login_time: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logout Time</label>
              <input type="datetime-local" value={correctForm.logout_time} onChange={e => setCorrectForm({ ...correctForm, logout_time: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={correctForm.status} onChange={e => setCorrectForm({ ...correctForm, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea value={correctForm.notes} onChange={e => setCorrectForm({ ...correctForm, notes: e.target.value })}
                rows={3} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Reason for correction..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCorrectModal(false)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
              <button onClick={handleCorrect} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Correction'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
