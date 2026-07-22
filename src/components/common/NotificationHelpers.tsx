import {
  Bell,
  DollarSign,
  Clock,
  Users,
  Activity,
  Check,
  X,
  FileEdit,
  Zap,
} from 'lucide-react';

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string | null;
  metadata: string | null;
};

// ponytail: parse ISO strings natively instead of assuming unix seconds, avoid extra date libs
export function timeAgo(ts: string | null): string {
  if (!ts) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';
  const diff = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

export function formatNotificationTime(ts: string | null): string {
  if (!ts) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${month} ${day}, ${year} at ${hours}:${minutes} ${ampm}`;
}

interface NotificationIconProps {
  type: string;
  size?: number;
}

export function NotificationIcon({ type, size = 14 }: NotificationIconProps) {
  const props = { size, strokeWidth: 2 };
  switch (type) {
    case 'bill_ready':
    case 'payment_received':
      return <DollarSign {...props} />;
    case 'payment_reminder':
      return <Clock {...props} />;
    case 'tenant_accepted':
      return <Users {...props} />;
    case 'readings_submitted':
    case 'reading_pending_approval':
      return <Activity {...props} />;
    case 'reading_approved':
    case 'edit_approved':
      return <Check {...props} />;
    case 'reading_rejected':
    case 'edit_rejected':
      return <X {...props} />;
    case 'edit_request_raised':
      return <FileEdit {...props} />;
    case 'rate_changed':
      return <Zap {...props} />;
    default:
      return <Bell {...props} />;
  }
}

export function iconColorClass(type: string): string {
  switch (type) {
    case 'bill_ready':
    case 'payment_received':
      return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400';
    case 'payment_reminder':
      return 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400';
    case 'tenant_accepted':
      return 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400';
    case 'reading_approved':
    case 'edit_approved':
      return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400';
    case 'reading_rejected':
    case 'edit_rejected':
      return 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400';
    case 'rate_changed':
      return 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-400';
    default:
      return 'text-muted-foreground bg-muted';
  }
}
