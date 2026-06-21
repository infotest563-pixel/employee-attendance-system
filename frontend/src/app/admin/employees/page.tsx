'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, Key, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  date_of_joining: string;
  is_active: number;
  role: string;
}

const emptyForm = {
  employee_id: '', first_name: '', last_name: '', email: '',
  phone: '', department: '', designation: '', date_of_joining: '', password: '', is_active: 1,
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get(`/employees${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setEmployees(res.data.data);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(t);
  }, [fetchEmployees]);

  const handleAdd = async () => {
    if (!form.employee_id || !form.first_name || !form.last_name || !form.email || !form.password) {
      toast.error('Please fill in all required fields'); return;
    }
    setSaving(true);
    try {
      await api.post('/employees', form);
      toast.success('Employee added successfully');
      setShowAddModal(false);
      setForm(emptyForm);
      fetchEmployees();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add employee');
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!selectedEmployee) return;
    setSaving(true);
    try {
      await api.put(`/employees/${selectedEmployee.employee_id}`, form);
      toast.success('Employee updated');
      setShowEditModal(false);
      fetchEmployees();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Deactivate ${emp.first_name} ${emp.last_name}?`)) return;
    try {
      await api.delete(`/employees/${emp.employee_id}`);
      toast.success('Employee deactivated');
      fetchEmployees();
    } catch { toast.error('Failed to deactivate employee'); }
  };

  const handleResetPassword = async () => {
    if (!selectedEmployee || !newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    setSaving(true);
    try {
      await api.post(`/employees/${selectedEmployee.employee_id}/reset-password`, { new_password: newPassword });
      toast.success('Password reset successfully');
      setShowResetModal(false);
      setNewPassword('');
    } catch { toast.error('Failed to reset password'); }
    finally { setSaving(false); }
  };

  const openEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setForm({
      employee_id: emp.employee_id, first_name: emp.first_name, last_name: emp.last_name,
      email: emp.email, phone: emp.phone || '', department: emp.department || '',
      designation: emp.designation || '', date_of_joining: emp.date_of_joining?.split('T')[0] || '',
      password: '', is_active: emp.is_active,
    });
    setShowEditModal(true);
  };

  const FormFields = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee ID *</label>
          <input type="text" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value.toUpperCase() })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="EMP001" />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
        <input type="text" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="John" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
        <input type="text" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Doe" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="john@company.com" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="+1 555 000 0000" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
        <input type="text" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Engineering" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Designation</label>
        <input type="text" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Software Engineer" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Joining</label>
        <input type="date" value={form.date_of_joining} onChange={e => setForm({ ...form, date_of_joining: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {!isEdit && (
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Password *</label>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Min 6 characters" />
        </div>
      )}
      {isEdit && (
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
          <select value={form.is_active} onChange={e => setForm({ ...form, is_active: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout title="Employees">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => { setForm(emptyForm); setShowAddModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
        <button onClick={fetchEmployees} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-6 py-3">Employee</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 hidden md:table-cell">Department</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 hidden lg:table-cell">Designation</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 hidden xl:table-cell">Joining Date</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : employees.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No employees found</td></tr>
              ) : employees.map((emp) => (
                <tr key={emp.id} className="table-row-hover border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {emp.first_name?.[0]}{emp.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{emp.first_name} {emp.last_name}</p>
                        <p className="text-xs text-gray-400">{emp.employee_id} · {emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-600 dark:text-gray-400">{emp.department || '-'}</td>
                  <td className="px-4 py-4 hidden lg:table-cell text-sm text-gray-600 dark:text-gray-400">{emp.designation || '-'}</td>
                  <td className="px-4 py-4 hidden xl:table-cell text-sm text-gray-600 dark:text-gray-400">{emp.date_of_joining ? formatDate(emp.date_of_joining) : '-'}</td>
                  <td className="px-4 py-4">
                    {emp.is_active ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                        <UserCheck className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                        <UserX className="w-3.5 h-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setSelectedEmployee(emp); setNewPassword(''); setShowResetModal(true); }}
                        className="p-1.5 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition" title="Reset Password">
                        <Key className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(emp)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Deactivate">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Employee" size="xl">
        <FormFields />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
          <button onClick={handleAdd} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Employee'}
          </button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={`Edit Employee: ${selectedEmployee?.employee_id}`} size="xl">
        <FormFields isEdit />
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
          <button onClick={handleEdit} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={showResetModal} onClose={() => setShowResetModal(false)} title="Reset Password" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Reset password for <strong>{selectedEmployee?.first_name} {selectedEmployee?.last_name}</strong>
        </p>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Min 6 characters" />
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowResetModal(false)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
          <button onClick={handleResetPassword} disabled={saving} className="px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium transition disabled:opacity-50">
            {saving ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
