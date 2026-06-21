'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { FileSpreadsheet, FileText, BarChart2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export default function EmployeeReportsPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${process.env.NEXT_PUBLIC_API_URL}/reports/export/${type}?from=${from}&to=${to}&employee_id=${user?.employee_id}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `my_attendance_${from}_${to}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} report downloaded`);
    } catch { toast.error('Export failed. You may not have permission.'); }
    finally { setExporting(false); }
  };

  return (
    <DashboardLayout title="My Reports">
      <div className="max-w-lg">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-5">
            <BarChart2 className="w-4 h-4 text-blue-600" /> Export My Attendance
          </h3>
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              {[
                { label: 'This Month', fn: () => { setFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setTo(format(endOfMonth(new Date()), 'yyyy-MM-dd')); } },
                { label: 'Last 30 Days', fn: () => { const d = new Date(); d.setDate(d.getDate() - 30); setFrom(format(d, 'yyyy-MM-dd')); setTo(format(new Date(), 'yyyy-MM-dd')); } },
                { label: 'This Year', fn: () => { setFrom(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd')); setTo(format(new Date(), 'yyyy-MM-dd')); } },
              ].map(q => (
                <button key={q.label} onClick={q.fn}
                  className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 transition">
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleExport('excel')} disabled={exporting}
              className="flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl text-sm font-semibold transition">
              <FileSpreadsheet className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Excel (.xlsx)'}
            </button>
            <button onClick={() => handleExport('pdf')} disabled={exporting}
              className="flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition">
              <FileText className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'PDF Report'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Reports will include your attendance from {from} to {to}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
