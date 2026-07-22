import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { EmptyState } from '../common/LoadingStates';
import {
  type Notification,
  formatNotificationTime,
  NotificationIcon,
  iconColorClass,
} from '../common/NotificationHelpers';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 20;

  useEffect(() => {
    loadNotifications(null, true);
  }, []);

  const loadNotifications = async (beforeCursor: string | null, reset = false) => {
    setIsLoading(true);
    const url = `/notifications?limit=${PAGE_SIZE}${beforeCursor ? `&before=${beforeCursor}` : ''}`;
    const { data } = await apiClient.get<Notification[]>(url);
    const list: Notification[] = data ?? [];
    setNotifications(prev => reset ? list : [...prev, ...list]);
    setHasMore(list.length === PAGE_SIZE);
    if (list.length > 0) setCursor(String(list[list.length - 1].createdAt));
    setIsLoading(false);
  };

  const markRead = async (id: string) => {
    await apiClient.patch(`/notifications/${id}/read`, {});
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n)
    );
  };

  const markAllRead = async () => {
    await apiClient.post('/notifications/read-all', {});
    setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
  };

  const unreadCount = notifications.filter(n => !n.readAt).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors border rounded-md px-3 py-1.5"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="rounded-xl border bg-card shadow divide-y overflow-hidden">
        {isLoading && notifications.length === 0 ? (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-14 bg-muted/50 rounded-lg" />
            <div className="h-14 bg-muted/50 rounded-lg" />
            <div className="h-14 bg-muted/50 rounded-lg" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            description="You will be notified about bills, readings, and tenant activity here."
            icon={<Bell size={24} className="text-muted-foreground" />}
          />
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.readAt && markRead(n.id)}
              className={`flex gap-4 px-6 py-4 transition-colors hover:bg-muted/50 ${!n.readAt ? 'bg-primary/5 cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${iconColorClass(n.type)}`}>
                <NotificationIcon type={n.type} size={15} />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className={`text-sm ${!n.readAt ? 'font-semibold' : ''}`}>{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="text-xs text-muted-foreground/60 pt-0.5">{formatNotificationTime(n.createdAt)}</p>
              </div>
              {!n.readAt && (
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              )}
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => loadNotifications(cursor)}
            disabled={isLoading}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors border rounded-md px-4 py-2 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
