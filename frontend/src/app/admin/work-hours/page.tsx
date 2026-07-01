'use client';

import { useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { Plus, Trash2, Clock, Calculator, Download } from 'lucide-react';
import { format } from 'date-fns';

interface EmployeeRow {
  id: string;
  name: string;
  inTime: string;   // "HH:MM"
  outTime: string;  // "HH:MM"
  breakMins: number;
}

const emptyRow = (): EmployeeRow => ({
  id: Math.random().toString(36).slice(2),
  name: '',
  inTime: '',
  outTime: '',
  breakMins: 0,
});

// Convert "HH:MM" string to total minutes from midnight
function timeToMins(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert minutes to "Xh Ym" string
function minsToLabel(m: number): string {
  if (m <= 0) return '0h 0m';
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Format minutes as decimal hours e.g. 9.5
function minsToDecimal(m: number): string {
  return (m / 60).toFixed(2);
}

export default function WorkHoursPage() {
  const today = format(new Date(), 'yyyy-MM-dd');

  // Shift configuration
  const [jobHours, setJobHours] = useState(9);           // standard work hours
  const [shiftStart, setShiftStart] = useState('09:00'); // main shift start
  const [shiftEnd, setShiftEnd] = useState('18:00');     // main shift end

  // Employee rows
  const [rows, setRows] = useState<EmployeeRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [date, setDate] = useState(today);

  const addRow = () => setRows(r => [...r, emptyRow()]);
  const removeRow = (id: string) => setRows(r => r.filter(x => x.id !== id));

  const updateRow = (id: string, field: keyof EmployeeRow, value: string | number) => {
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  // Calculate for a single row
  const calc = useCallback((row: EmployeeRow) => {
    if (!row.inTime || !row.outTime) return null;
    const inMins  = timeToMins(row.inTime);
    const outMins = timeToMins(row.outTime);
    if (outMins <= inMins) return null;                      // invalid: out before in
    const totalMins   = outMins - inMins - (row.breakMins || 0);
    const stdMins     = jobHours * 60;
    const overtimeMins = Math.max(0, totalMins - stdMins);
    return { totalMins, overtimeMins };
  }, [jobHours]);

  const shiftMins = timeToMins(shiftEnd) - timeToMins(shiftStart);

  // Export as CSV
  const exportCSV = () => {
    const lines = [
      `Work Hours Report — ${date}`,
      `Standard Hours: ${jobHours}h | Shift: ${shiftStart}–${shiftEnd}`,
      '',
      'Name,In,Out,Break(min),Total Hours,Overtime',
      ...rows.map(row => {
        const r = calc(row);
        return `${row.name},${row.inTime},${row.outTime},${row.breakMins},${r ? minsToDecimal(r.totalMins) : '-'},${r ? minsToDecimal(r.overtimeMins) : '-'}`;
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `work_hours_${date}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('CSV downloaded');
  };

  return (
    <DashboardLayout title="Work Hours Calculator">
      {/* ── Config Card ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-blue-600" /> Shift Configuration
        </h3>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* Job Hours */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Job Total Hours</label>
            <input type="number" min={1} max={24} value={jobHours}
              onChange={e => setJobHours(Number(e.target.value))}
              className="w-24 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* Shift Start */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Shift Start</label>
            <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* Shift End */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Shift End</label>
            <input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* Shift summary badge */}
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm font-medium text-blue-700 dark:text-blue-400">
            Shift: {minsToLabel(shiftMins)} | Standard: {jobHours}h
          </div>
        </div>
      </div>

      {/* ── Employee Table ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" /> Employee Hours — {date}
          </h3>
          <div className="flex gap-2">
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition">
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-10">#</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Employee Name</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Clock In</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Clock Out</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Break (min)</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Total Hours</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Overtime</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const result = calc(row);
                const hasOvertime = result && result.overtimeMins > 0;
                return (
                  <tr key={row.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{idx + 1}</td>
                    {/* Name */}
                    <td className="px-4 py-3">
                      <input value={row.name} onChange={e => updateRow(row.id, 'name', e.target.value)}
                        placeholder="Employee name"
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    {/* In */}
                    <td className="px-4 py-3">
                      <input type="time" value={row.inTime} onChange={e => updateRow(row.id, 'inTime', e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </td>
                    {/* Out */}
                    <td className="px-4 py-3">
                      <input type="time" value={row.outTime} onChange={e => updateRow(row.id, 'outTime', e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                    </td>
                    {/* Break */}
                    <td className="px-4 py-3">
                      <input type="number" min={0} max={480} value={row.breakMins}
                        onChange={e => updateRow(row.id, 'breakMins', Number(e.target.value))}
                        className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                    </td>
                    {/* Total */}
                    <td className="px-4 py-3">
                      {result ? (
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {minsToLabel(result.totalMins)}
                          <span className="text-gray-400 text-xs ml-1">({minsToDecimal(result.totalMins)}h)</span>
                        </span>
                      ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    {/* Overtime */}
                    <td className="px-4 py-3">
                      {result ? (
                        hasOvertime ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            +{minsToLabel(result.overtimeMins)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No OT</span>
                        )
                      ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    {/* Delete */}
                    <td className="px-4 py-3">
                      <button onClick={() => removeRow(row.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Summary Bar ── */}
      {(() => {
        const filled = rows.filter(r => r.inTime && r.outTime);
        if (!filled.length) return null;
        const totalWorking  = filled.reduce((s, r) => s + (calc(r)?.totalMins ?? 0), 0);
        const totalOvertime = filled.reduce((s, r) => s + (calc(r)?.overtimeMins ?? 0), 0);
        const avgHours      = totalWorking / filled.length;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Employees Logged',  value: filled.length,              sub: `of ${rows.length} rows`,         cls: 'bg-blue-50   dark:bg-blue-900/20   border-blue-100   dark:border-blue-800',   txt: 'text-blue-600   dark:text-blue-400',   val: 'text-blue-700   dark:text-blue-300'   },
              { label: 'Total Working Time', value: minsToLabel(totalWorking),  sub: `${minsToDecimal(totalWorking)}h`, cls: 'bg-green-50  dark:bg-green-900/20  border-green-100  dark:border-green-800',  txt: 'text-green-600  dark:text-green-400',  val: 'text-green-700  dark:text-green-300'  },
              { label: 'Average Per Person', value: minsToLabel(Math.round(avgHours)), sub: 'avg hours',              cls: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800', txt: 'text-purple-600 dark:text-purple-400', val: 'text-purple-700 dark:text-purple-300' },
              { label: 'Total Overtime',    value: minsToLabel(totalOvertime), sub: totalOvertime > 0 ? 'extra hours' : 'none', cls: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', txt: 'text-orange-600 dark:text-orange-400', val: 'text-orange-700 dark:text-orange-300' },
            ].map(c => (
              <div key={c.label} className={`rounded-2xl p-4 border ${c.cls}`}>
                <p className={`text-xs font-medium mb-1 ${c.txt}`}>{c.label}</p>
                <p className={`text-xl font-bold ${c.val}`}>{c.value}</p>
                <p className={`text-xs mt-0.5 ${c.txt} opacity-70`}>{c.sub}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </DashboardLayout>
  );
}
