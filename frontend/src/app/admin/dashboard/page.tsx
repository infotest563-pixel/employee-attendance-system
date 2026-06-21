'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/ui/StatCard';
import api from '@/lib/api';
import { Users, UserCheck, UserX, Activity, Coffee, Clock } from 'lucide-react';
import { formatDateTime, minutesToHours } from '@/lib/utils';

interface DashboardStats {
  total_employees: number;
  present_today: number;
  absent_today: number;
  working_now: number;
  on_break: number;
  total_working_hours_today: number;
}

interface RecentAttendance {
  employee_id: string;
  first_name: string;
  last_name: string;
  department: string;
  login_time: string;
  logout_time: string;
  status: string;
  total_working_minutes: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, attendanceRes] = await Promise.all([
        api.get('/attendance/dashboard/stats'),
        api.get('/attendance/all?limit=10'),
      ]);
      setStats(statsRes.data.data);
      setRecentAttendance(attendanceRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      present: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      absent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      half_day: 'bg-yellow-100 text-yellow-700',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <StatCard
          title="Total Employees"
          value={stats?.total_employees ?? 0}
          subtitle="Active employees"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Present Today"
          value={stats?.present_today ?? 0}
          subtitle="Clocked in today"
          icon={UserCheck}
          color="green"
        />
        <StatCard
          title="Absent Today"
          value={stats?.absent_today ?? 0}
          subtitle="Not yet clocked in"
          icon={UserX}
          color="red"
        />
        <StatCard
          title="Working Now"
          value={stats?.working_now ?? 0}
          subtitle="Currently active"
          icon={Activity}
          color="purple"
        />
        <StatCard
          title="On Break"
          value={stats?.on_break ?? 0}
          subtitle="Currently on break"
          icon={Coffee}
          color="yellow"
        />
        <StatCard
          title="Total Hours Today"
          value={`${stats?.total_working_hours_today ?? 0}h`}
          subtitle="Combined working hours"
          icon={Clock}
          color="orange"
        />
      </div>

      {/* Recent Attendance Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Recent Attendance</h2>
          <a href="/admin/attendance" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-6 py-3">Employee</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 hidden md:table-cell">Department</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Login Time</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 hidden lg:table-cell">Logout Time</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 hidden lg:table-cell">Working Hours</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentAttendance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No attendance records found for today
                  </td>
                </tr>
              ) : recentAttendance.map((record) => (
                <tr key={`${record.employee_id}-${record.login_time}`} className="table-row-hover border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {record.first_name?.[0]}{record.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {record.first_name} {record.last_name}
                        </p>
                        <p className="text-xs text-gray-400">{record.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{record.department || '-'}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{record.login_time ? formatDateTime(record.login_time) : '-'}</span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{record.logout_time ? formatDateTime(record.logout_time) : <span className="text-green-500 text-xs font-medium animate-pulse">● Active</span>}</span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{minutesToHours(record.total_working_minutes)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
