import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../lib/api-client';
import {
  type Notification,
  formatNotificationTime,
  NotificationIcon,
  iconColorClass,
} from './NotificationHelpers';



export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    const { data } = await apiClient.get<Notification[]>('/notifications?limit=5');
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.readAt).length);
    }
    setIsLoading(false);
  };

  const markAllRead = async () => {
    await apiClient.post('/notifications/read-all', {});
    setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
    setUnreadCount(0);
  };

  const markRead = async (id: string) => {
    await apiClient.patch(`/notifications/${id}/read`, {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34,
          border: 'none', background: 'none',
          borderRadius: 6,
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          transition: 'background-color 150ms, color 150ms',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)';
          e.currentTarget.style.color = 'var(--color-text)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--color-text-muted)';
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            minWidth: 16, height: 16,
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: '50%',
            fontSize: '0.625rem',
            fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
            padding: '0 3px',
          }} aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            width: 320, zIndex: 999,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: '0.75rem', color: 'var(--color-text-muted)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, fontFamily: 'var(--font-body)',
                  transition: 'color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n, i) => (
                <div
                  key={n.id}
                  onClick={() => !n.readAt && markRead(n.id)}
                  style={{
                    display: 'flex', gap: 12,
                    padding: '12px 16px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                    backgroundColor: !n.readAt ? 'rgba(99,102,241,0.05)' : 'transparent',
                    cursor: !n.readAt ? 'pointer' : 'default',
                    transition: 'background-color 150ms',
                  }}
                  onMouseEnter={e => { if (!n.readAt) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.09)'; }}
                  onMouseLeave={e => { if (!n.readAt) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.05)'; }}
                >
                  <div className={`${iconColorClass(n.type)}`} style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    <NotificationIcon type={n.type} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      fontWeight: !n.readAt ? 600 : 400,
                      color: 'var(--color-text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {n.title}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {n.body}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: 'var(--color-text-muted)', opacity: 0.7 }}>
                      {formatNotificationTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.readAt && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: 'var(--color-accent)',
                      flexShrink: 0, marginTop: 6,
                    }} aria-hidden="true" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
            <a
              href="/notifications"
              style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', textDecoration: 'none', transition: 'color 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
            >
              View all notifications →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
