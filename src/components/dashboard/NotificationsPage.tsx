import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { EmptyState } from "../common/LoadingStates";
import {
  type Notification,
  formatNotificationTime,
  NotificationIcon,
  iconColorClass,
} from "../common/NotificationHelpers";
import { withErrorBoundary } from "../common/withErrorBoundary";

function NotificationsPageInner() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  useEffect(() => {
    loadNotifications(true);
  }, []);

  const loadNotifications = async (reset = false) => {
    if (reset) setCursor(null);
    setIsLoading(true);
    const url = `/notifications?limit=${PAGE_SIZE}${!reset && cursor ? `&cursor=${cursor}` : ""}`;
    const response = await apiClient.get<Notification[]>(url);

    if (response.error) {
      setFetchError(response.error.message || "Could not load notifications.");
      setIsLoading(false);
      return;
    }

    setFetchError(null);
    const list: Notification[] = response.data ?? [];
    setNotifications((prev) => (reset ? list : [...prev, ...list]));
    setHasMore(list.length === PAGE_SIZE);
    if (list.length > 0) setCursor(String(list[list.length - 1].createdAt));
    setIsLoading(false);
  };

  const markRead = async (id: string) => {
    const response = await apiClient.patch(`/notifications/${id}/read`, {});
    if (response.error) return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n
      )
    );
  };

  const markAllRead = async () => {
    const response = await apiClient.post("/notifications/read-all", {});
    if (response.error) return;
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
    );
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
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
        {fetchError && notifications.length === 0 ? (
          <div className="p-6 text-center text-destructive">
            <p className="font-medium">Failed to load notifications</p>
            <p className="text-sm mt-1">{fetchError}</p>
            <button
              onClick={() => loadNotifications(true)}
              className="mt-4 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        ) : isLoading && notifications.length === 0 ? (
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
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.readAt && markRead(n.id)}
              className={`flex gap-4 px-6 py-4 transition-colors hover:bg-muted/50 ${!n.readAt ? "bg-primary/5 cursor-pointer" : "cursor-default"}`}
              role={!n.readAt ? "button" : undefined}
              tabIndex={!n.readAt ? 0 : undefined}
              aria-label={!n.readAt ? `Mark as read: ${n.title}` : undefined}
              onKeyDown={(e) => {
                if (!n.readAt && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  markRead(n.id);
                }
              }}
            >
              <div
                className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${iconColorClass(n.type)}`}
              >
                <NotificationIcon type={n.type} size={15} />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className={`text-sm ${!n.readAt ? "font-semibold" : ""}`}>
                  {n.title}
                </p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="text-xs text-muted-foreground/60 pt-0.5">
                  {formatNotificationTime(n.createdAt)}
                </p>
              </div>
              {!n.readAt && (
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              )}
            </div>
          ))
        )}
      </div>

      {(hasMore || (fetchError && notifications.length > 0)) && (
        <div className="text-center flex flex-col items-center gap-2">
          {fetchError && notifications.length > 0 && (
            <p className="text-sm text-destructive">{fetchError}</p>
          )}
          {hasMore && (
            <button
              onClick={() => loadNotifications(false)}
              disabled={isLoading}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors border rounded-md px-4 py-2 disabled:opacity-50"
            >
              {isLoading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const NotificationsPage = withErrorBoundary(NotificationsPageInner);
