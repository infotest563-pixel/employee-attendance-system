'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, LogIn, Shield, ChevronDown, ChevronUp } from 'lucide-react';

const DEMO_USERS = [
  { role: 'Admin',    id: 'ADMIN001', name: 'System Admin',  email: 'admin@company.com',  password: 'password' },
  { role: 'Employee', id: 'EMP001',   name: 'John Doe',      email: 'john@company.com',   password: 'emp123'   },
  { role: 'Employee', id: 'EMP002',   name: 'Jane Smith',    email: 'jane@company.com',   password: 'emp123'   },
  { role: 'Employee', id: 'EMP003',   name: 'Bob Wilson',    email: 'bob@company.com',    password: 'emp123'   },
];

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !password.trim()) {
      toast.error('Please enter Employee ID and Password');
      return;
    }
    setLoading(true);
    try {
      const userData = await login(employeeId, password);
      toast.success('Login successful!');
      // Use returned user data directly — don't rely on localStorage timing
      if (userData?.role === 'admin') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/employee/dashboard');
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Invalid credentials';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="text-white font-bold text-xl">AttendTrack</span>
        </div>
        <div>
          <h1 className="text-5xl font-bold text-white leading-tight mb-6">
            Employee Attendance<br />Management System
          </h1>
          <p className="text-blue-200 text-lg max-w-md">
            Track attendance, manage breaks, and generate comprehensive reports — all in one place.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { label: 'Real-time Tracking', icon: '⚡' },
              { label: 'Smart Reports', icon: '📊' },
              { label: 'Break Management', icon: '☕' },
              { label: 'Role-based Access', icon: '🔐' },
            ].map((f) => (
              <div key={f.label} className="bg-white/10 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">{f.icon}</span>
                <span className="text-white font-medium text-sm">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-blue-300 text-sm">© 2024 AttendTrack. All rights reserved.</p>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-800 dark:text-white">AttendTrack</span>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-800">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                  placeholder="e.g. EMP001"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 rounded-xl border border-blue-100 dark:border-blue-800 overflow-hidden">
              {/* Toggle header */}
              <button
                type="button"
                onClick={() => setShowDemo(!showDemo)}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
              >
                <span className="text-xs font-semibold tracking-wide uppercase">Demo Credentials</span>
                {showDemo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Expandable table */}
              {showDemo && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-blue-50/80 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800">
                        <th className="text-left px-3 py-2 font-medium text-blue-600 dark:text-blue-400">Role</th>
                        <th className="text-left px-3 py-2 font-medium text-blue-600 dark:text-blue-400">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-blue-600 dark:text-blue-400">Email</th>
                        <th className="text-left px-3 py-2 font-medium text-blue-600 dark:text-blue-400">ID</th>
                        <th className="text-left px-3 py-2 font-medium text-blue-600 dark:text-blue-400">Password</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_USERS.map((u) => (
                        <tr key={u.id} className="border-b border-blue-50 dark:border-blue-900/30 last:border-0 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition">
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded font-semibold ${u.role === 'Admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">{u.name}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono">{u.email}</td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-800 dark:text-gray-200">{u.id}</td>
                          <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">{u.password}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => { setEmployeeId(u.id); setPassword(u.password); }}
                              className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition whitespace-nowrap"
                            >
                              Use
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
