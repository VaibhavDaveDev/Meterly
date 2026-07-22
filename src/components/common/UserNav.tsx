import { useState, useEffect, useRef } from 'react';
import { authClient } from '../../lib/auth-client';

type User = { name: string; email: string; image?: string | null };

// ponytail: initials avatar — no external dep needed
function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ');
  const abbr = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2);
  return (
    <span style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 30, height: 30, borderRadius: '50%',
      backgroundColor: 'var(--color-accent)', color: '#fff',
      fontSize: '0.6875rem', fontWeight: 700,
      fontFamily: 'var(--font-body)', userSelect: 'none',
      flexShrink: 0,
    }}>
      {abbr.toUpperCase()}
    </span>
  );
}

export function UserNav() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authClient.getSession().then(r => {
      if (r.data?.user) setUser(r.data.user as User);
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  const signOut = async () => {
    await authClient.signOut();
    window.location.href = '/login';
  };

  if (!user) return <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-surface-raised)' }} />;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
      >
        {user.image
          ? <img src={user.image} alt={user.name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', backgroundColor: '#f8fafc' }} />
          : <Initials name={user.name} />
        }
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account options"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            width: 220, zIndex: 999,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          {/* Identity */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
              {user.name}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </p>
          </div>

          {/* Links */}
          <div style={{ padding: '4px 0' }}>
            <a
              href="/settings"
              role="menuitem"
              style={{ display: 'block', padding: '9px 16px', fontSize: '0.875rem', color: 'var(--color-text)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Settings
            </a>
            <button
              role="menuitem"
              onClick={signOut}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 16px', fontSize: '0.875rem',
                color: 'var(--color-error)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
