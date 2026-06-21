import { format, parseISO } from 'date-fns';

export const formatDate = (date: string | Date): string => {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'dd/MM/yyyy');
  } catch { return String(date); }
};

export const formatDateTime = (date: string | Date): string => {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'dd/MM/yyyy hh:mm a');  // 12-hour: 21/06/2026 04:09 PM
  } catch { return String(date); }
};

export const formatTime = (date: string | Date): string => {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'hh:mm a');  // 12-hour: 04:09 PM
  } catch { return String(date); }
};

export const minutesToHours = (minutes: number): string => {
  if (!minutes || minutes < 0) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

export const breakReasonLabel = (reason: string): string => {
  const map: Record<string, string> = {
    lunch_break: 'Lunch Break',
    tea_break: 'Tea Break',
    meeting: 'Meeting',
    personal_work: 'Personal Work',
  };
  return map[reason] || reason;
};

export const statusColor = (status: string): string => {
  const map: Record<string, string> = {
    present: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    absent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    half_day: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    on_leave: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

export const cn = (...classes: (string | undefined | null | false)[]): string =>
  classes.filter(Boolean).join(' ');
