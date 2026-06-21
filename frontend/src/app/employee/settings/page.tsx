'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, User } from 'lucide-react';

export default function EmployeeSettingsPage() {
  const { user } = useAuth();
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('Passwords do not match'); return;
    }
    if (pwForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success('Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to change password');
    } finally { setSaving(false); }
  };

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-xl space-y-6">
        {/* Profile card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-blue-600" /> My Profile
          </h3>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-bold">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div>
              <p className="text-xl font-semibold text-gray-800 dark:text-white">{user?.first_name} {user?.last_name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Employee ID', value: user?.employee_id },
              { label: 'Department', value: user?.department || '-' },
              { label: 'Designation', value: user?.designation || '-' },
              { label: 'Role', value: 'Employee' },
            ].map(f => (
              <div key={f.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">{f.label}</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-blue-600" /> Change Password
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {[
              { label: 'Current Password', key: 'current_password', placeholder: 'Your current password' },
              { label: 'New Password', key: 'new_password', placeholder: 'Minimum 6 characters' },
              { label: 'Confirm New Password', key: 'confirm_password', placeholder: 'Repeat new password' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                <input type="password" placeholder={f.placeholder}
                  value={pwForm[f.key as keyof typeof pwForm]}
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
