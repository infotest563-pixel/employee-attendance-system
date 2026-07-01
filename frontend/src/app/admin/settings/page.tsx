'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, User, Shield, Clock, Save } from 'lucide-react';

interface ShiftConfig {
  shift_start: string;
  shift_end: string;
  standard_hours: number;
  max_overtime_hours: number;
  overtime_rate: number;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const [shiftForm, setShiftForm] = useState<ShiftConfig>({
    shift_start: '09:00', shift_end: '18:00',
    standard_hours: 9, max_overtime_hours: 4, overtime_rate: 1.5,
  });
  const [shiftSaving, setShiftSaving] = useState(false);

  useEffect(() => {
    api.get('/attendance/shift-config').then(res => {
      if (res.data.data) setShiftForm(res.data.data);
    }).catch(() => {});
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) { toast.error('Passwords do not match'); return; }
    if (pwForm.new_password.length < 6) { toast.error('Min 6 characters'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftSaving(true);
    try {
      await api.put('/attendance/shift-config', shiftForm);
      toast.success('Shift configuration saved!');
    } catch { toast.error('Failed to save shift config'); }
    finally { setShiftSaving(false); }
  };

  // Calculate shift duration for preview
  const calcShiftMins = () => {
    const [sh, sm] = shiftForm.shift_start.split(':').map(Number);
    const [eh, em] = shiftForm.shift_end.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? `${Math.floor(mins/60)}h ${mins%60}m` : '-';
  };

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-2xl space-y-6">

        {/* Profile */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-blue-600" /> Profile
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-bold">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800 dark:text-white">{user?.first_name} {user?.last_name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full mt-1">
                <Shield className="w-3 h-3" /> Admin
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[['Employee ID', user?.employee_id], ['Department', user?.department || '-'], ['Designation', user?.designation || '-']].map(([label, val]) => (
              <div key={label as string} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-0.5">{label}</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Shift Configuration ── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-600" /> Shift Configuration
          </h3>
          <p className="text-xs text-gray-400 mb-5">Set working hours, overtime limit and rate for all employees</p>

          <form onSubmit={handleSaveShift} className="space-y-5">
            {/* Shift times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shift Start Time</label>
                <input type="time" value={shiftForm.shift_start}
                  onChange={e => setShiftForm({ ...shiftForm, shift_start: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shift End Time</label>
                <input type="time" value={shiftForm.shift_end}
                  onChange={e => setShiftForm({ ...shiftForm, shift_end: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Hours config */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Standard Hours/Day</label>
                <input type="number" min={1} max={24} step={0.5} value={shiftForm.standard_hours}
                  onChange={e => setShiftForm({ ...shiftForm, standard_hours: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Overtime Hours</label>
                <input type="number" min={0} max={12} step={0.5} value={shiftForm.max_overtime_hours}
                  onChange={e => setShiftForm({ ...shiftForm, max_overtime_hours: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Overtime Rate (×)</label>
                <input type="number" min={1} max={5} step={0.1} value={shiftForm.overtime_rate}
                  onChange={e => setShiftForm({ ...shiftForm, overtime_rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Preview */}
            <div className="flex flex-wrap gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm">
              <span className="text-blue-700 dark:text-blue-300 font-medium">Preview:</span>
              <span className="text-blue-600 dark:text-blue-400">Shift: {shiftForm.shift_start} – {shiftForm.shift_end} ({calcShiftMins()})</span>
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span className="text-blue-600 dark:text-blue-400">Standard: {shiftForm.standard_hours}h/day</span>
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span className="text-orange-600 dark:text-orange-400">OT: max {shiftForm.max_overtime_hours}h @ {shiftForm.overtime_rate}× rate</span>
            </div>

            <button type="submit" disabled={shiftSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium transition">
              <Save className="w-4 h-4" />
              {shiftSaving ? 'Saving...' : 'Save Shift Config'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-blue-600" /> Change Password
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {[
              { label: 'Current Password', key: 'current_password' },
              { label: 'New Password', key: 'new_password' },
              { label: 'Confirm New Password', key: 'confirm_password' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                <input type="password" value={pwForm[f.key as keyof typeof pwForm]}
                  onChange={e => setPwForm({ ...pwForm, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <button type="submit" disabled={saving}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium transition">
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

      </div>
    </DashboardLayout>
  );
}
