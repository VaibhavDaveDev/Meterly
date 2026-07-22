import { useState, useEffect, type SubmitEvent } from 'react';
import { authClient } from '../../lib/auth-client';
import { useToast } from '../../hooks/use-toast';
import { getGravatarUrl } from '../../api/lib/avatar';
import { DiceBearPicker } from './DiceBearPicker';

type User = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

// ponytail: parse DiceBear seed from URL (lorelei only)
function parseDiceBearUrl(url: string | null | undefined): { seed: string } {
  const fallback = { seed: '' };
  if (!url) return fallback;
  try {
    const u = new URL(url);
    const seed = u.searchParams.get('seed') || '';
    return { seed };
  } catch {
    return fallback;
  }
}

// ponytail: initials helper matching UserNav fallback
const getInitials = (nameStr: string) => {
  const parts = nameStr.trim().split(' ');
  return parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : nameStr.slice(0, 2);
};


export function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Profile fields
  const [name, setName] = useState('');
  const [avatarType, setAvatarType] = useState<'initials' | 'gravatar' | 'dicebear'>('initials');
  const [dicebearSeed, setDicebearSeed] = useState('');
  const [gravatarUrl, setGravatarUrl] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const { toast } = useToast();

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  // null = loading, true = has email+password, false = OAuth only
  const [hasPasswordAccount, setHasPasswordAccount] = useState<boolean | null>(null);

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = (localStorage.getItem('meterly-theme') as 'light' | 'dark' | 'system') || 'dark';
    setTheme(savedTheme);

    authClient.getSession().then(result => {
      if (result.data?.user) {
        const u = result.data.user;
        setUser(u as User);
        setName(u.name);
        
        const img = u.image;
        if (!img) {
          setAvatarType('initials');
          setDicebearSeed(u.name || u.id);
        } else if (img.includes('gravatar.com')) {
          setAvatarType('gravatar');
          setDicebearSeed(u.name || u.id);
        } else if (img.includes('dicebear.com')) {
          setAvatarType('dicebear');
          const parsed = parseDiceBearUrl(img);
          setDicebearSeed(parsed.seed || u.name || u.id);
        } else {
          setAvatarType('initials');
          setDicebearSeed(u.name || u.id);
        }
      }
      setIsLoading(false);
    });

    // Detect whether the user signed up with email+password or OAuth-only.
    // Better Auth's listAccounts returns each linked provider.
    // The email+password account uses provider = 'credential'.
    authClient.listAccounts().then(result => {
      if (result.data) {
        const hasEmail = (result.data as Array<{ providerId: string }>).some(
          (acc) => acc.providerId === 'credential'
        );
        setHasPasswordAccount(hasEmail);
      } else {
        setHasPasswordAccount(true); // fallback: assume yes
      }
    }).catch(() => setHasPasswordAccount(true));
  }, []);

  // Update Gravatar preview when user email is loaded
  useEffect(() => {
    if (user?.email) {
      getGravatarUrl(user.email).then(url => setGravatarUrl(url));
    }
  }, [user?.email]);

  const handleSave = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: 'Validation error',
        description: 'Name cannot be empty.',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      let finalImage: string | null = null;
      if (avatarType === 'gravatar') {
        finalImage = gravatarUrl || await getGravatarUrl(user?.email || '');
      } else if (avatarType === 'dicebear') {
        finalImage = `https://api.dicebear.com/8.x/lorelei/svg?seed=${encodeURIComponent(dicebearSeed)}&backgroundColor=f8fafc`;
      } // initials leaves finalImage as null

      const { error } = await authClient.updateUser({
        name: name.trim(),
        image: finalImage
      });

      if (error) {
        toast({
          title: 'Error updating profile',
          description: error.message || 'Please try again.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Profile updated',
          description: 'Your changes have been saved successfully.',
        });
        // Update local user state
        setUser(prev => prev ? { ...prev, name: name.trim(), image: finalImage } : null);
      }
    } catch {
      toast({
        title: 'Error updating profile',
        description: 'An unexpected error occurred.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentPassword) {
      toast({
        title: 'Validation error',
        description: 'Current password is required.',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: 'Validation error',
        description: 'New password must be at least 8 characters long.',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Validation error',
        description: 'New passwords do not match.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });

      if (error) {
        toast({
          title: 'Error changing password',
          description: error.message || 'Please try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Password updated',
          description: 'Your password has been changed successfully. A confirmation email has been sent.',
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      toast({
        title: 'Error changing password',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await authClient.signOut();
    window.location.href = '/login';
  };

  // ponytail: client-side theme switcher matching astro layouts
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('meterly-theme', newTheme);
    const dark = newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    toast({
      title: 'Theme updated',
      description: `Interface style set to ${newTheme}.`
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '560px' }}>
        {[1, 2].map(i => (
          <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '8px' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 700 }}>Settings</h2>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--color-text-muted)' }}>
          Manage your account
        </p>
      </div>

      {/* Profile */}
      <form onSubmit={handleSave} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'row', gap: '40px', flexWrap: 'wrap' }}>
        
        {/* Left: Avatar Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', minWidth: '160px' }}>
          <div style={{ width: '140px', height: '140px', borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--color-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--color-border)' }}>
            {avatarType === 'initials' ? (
              <span style={{ fontSize: '3rem', fontWeight: 700, color: '#fff', backgroundColor: 'var(--color-accent)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}>
                {getInitials(name || user?.name || '').toUpperCase()}
              </span>
            ) : (
              <img
                src={avatarType === 'gravatar' ? gravatarUrl : `https://api.dicebear.com/8.x/lorelei/svg?seed=${encodeURIComponent(dicebearSeed)}&backgroundColor=f8fafc`}
                alt="Avatar preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Avatar Preview</h4>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', maxWidth: '140px' }}>
              {avatarType === 'initials' && 'Using name initials fallback'}
              {avatarType === 'gravatar' && 'Using your Gravatar profile picture'}
              {avatarType === 'dicebear' && 'Using DiceBear avatar selection'}
            </p>
          </div>
        </div>

        {/* Right: Info and Settings */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '280px' }}>
          {/* Name input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="form-label" htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                color: 'var(--color-text)',
                fontSize: '0.9375rem'
              }}
              required
              disabled={isSaving}
            />
          </div>

          {/* Email read-only */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="form-label">Email (cannot be changed)</div>
            <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--color-text-muted)' }}>{user?.email}</p>
          </div>

          {/* Avatar Type buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span className="form-label">Avatar Options</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {(['initials', 'gravatar', 'dicebear'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAvatarType(type)}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '6px',
                    border: `1px solid ${avatarType === type ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    backgroundColor: avatarType === type ? 'rgba(99, 102, 241, 0.1)' : 'var(--color-surface-raised)',
                    color: avatarType === type ? 'var(--color-text)' : 'var(--color-text-muted)',
                    fontSize: '0.8125rem',
                    fontWeight: 550,
                    cursor: 'pointer',
                    textAlign: 'center',
                    textTransform: 'capitalize',
                    transition: 'background-color var(--transition-fast), border-color var(--transition-fast)'
                  }}
                >
                  {type === 'initials' ? 'Initials' : type === 'gravatar' ? 'Gravatar' : 'DiceBear'}
                </button>
              ))}
            </div>
          </div>

          {/* DiceBear settings */}
          {avatarType === 'dicebear' && (
            <DiceBearPicker
              seed={dicebearSeed}
              isSaving={isSaving}
              onSeedChange={setDicebearSeed}
            />
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ alignSelf: 'flex-start', marginTop: '12px' }}
            disabled={isSaving}
          >
            {isSaving ? 'Saving changes...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Security Settings (Change Password) */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600 }}>Password</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {hasPasswordAccount === false
              ? 'You signed in with Google. You don\'t have a password yet.'
              : 'Update the password for your account.'}
          </p>
        </div>

        {/* OAuth-only user: no currentPassword — send them through forgot-password OTP flow */}
        {hasPasswordAccount === false ? (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              To set a password, use the password reset flow. We\'ll send a one-time code to your email.
            </p>
            <a
              href="/forgot-password"
              className="btn btn-primary"
              style={{ display: 'inline-block', textDecoration: 'none' }}
            >
              Set a Password
            </a>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '360px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="form-label" htmlFor="current-password">Current Password</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  color: 'var(--color-text)',
                  fontSize: '0.9375rem'
                }}
                required
                disabled={isChangingPassword}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="form-label" htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  color: 'var(--color-text)',
                  fontSize: '0.9375rem'
                }}
                required
                disabled={isChangingPassword}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="form-label" htmlFor="confirm-password">Confirm New Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  color: 'var(--color-text)',
                  fontSize: '0.9375rem'
                }}
                required
                disabled={isChangingPassword}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', marginTop: '8px' }}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? 'Updating password...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>

      {/* Appearance Settings */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600 }}>Appearance</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Choose your interface theme.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', maxWidth: '360px' }}>
          {(['light', 'dark', 'system'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => handleThemeChange(t)}
              style={{
                padding: '10px 6px',
                borderRadius: '6px',
                border: `1px solid ${theme === t ? 'var(--color-accent)' : 'var(--color-border)'}`,
                backgroundColor: theme === t ? 'rgba(99, 102, 241, 0.1)' : 'var(--color-surface-raised)',
                color: theme === t ? 'var(--color-text)' : 'var(--color-text-muted)',
                fontSize: '0.8125rem',
                fontWeight: 550,
                cursor: 'pointer',
                textAlign: 'center',
                textTransform: 'capitalize',
                transition: 'background-color var(--transition-fast), border-color var(--transition-fast)'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 600 }}>Account</h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Signing out will end your session on this device.
        </p>
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="btn btn-secondary"
        >
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
