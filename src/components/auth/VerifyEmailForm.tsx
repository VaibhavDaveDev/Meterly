import { useState, useEffect } from 'react';
import type { SubmitEvent } from 'react';
import { authClient } from '../../lib/auth-client';
import { AuthFormLayout } from './AuthFormLayout';

export function VerifyEmailForm() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
      setMessage('Check your email for the 6-digit verification code');
    }
  }, []);

  const handleVerify = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setIsError(false);

    const { error } = await authClient.emailOtp.verifyEmail({ email, otp });

    if (error) {
      setMessage(error.message || 'Invalid code. Try again.');
      setIsError(true);
      setIsLoading(false);
    } else {
      setMessage('Email verified! Redirecting...');
      setTimeout(() => { window.location.href = '/login?verified=true'; }, 1500);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    color: 'var(--color-text)',
    fontSize: '0.9375rem',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    transition: 'border-color 200ms',
    boxSizing: 'border-box' as const,
  };

  return (
    <AuthFormLayout
      title="Verify your email"
      description={`We sent a 6-digit code to ${email || 'your email'}`}
      backToLink={{ href: '/login', label: 'Back to sign in' }}
      message={message}
      isError={isError}
      isLoading={isLoading}
    >
      <form onSubmit={handleVerify} method="post" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!email && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="email" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              placeholder="you@example.com"
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="otp" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
            Verification code
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            maxLength={6}
            autoFocus
            style={{
              ...inputStyle,
              textAlign: 'center',
              fontSize: '1.5rem',
              letterSpacing: '0.3em',
              fontFamily: 'var(--font-mono)',
            }}
            placeholder="000000"
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          />
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Code expires in 10 minutes. Check your spam folder if not received.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || otp.length !== 6}
          className="btn btn-primary"
          style={{ width: '100%' }}
        >
          {isLoading ? 'Verifying...' : 'Verify email'}
        </button>
      </form>
    </AuthFormLayout>
  );
}
