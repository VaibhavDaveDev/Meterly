import { useState, type SubmitEvent } from 'react';
import { authClient } from '../../lib/auth-client';
import { useTurnstile } from '../../hooks/use-turnstile';
import { AuthFormLayout } from './AuthFormLayout';
import { EmailInput, PasswordInput, TextInput } from './AuthInputs';

const GithubSVG = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
  </svg>
);

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"></path>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"></path>
    <path d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.177 0 7.548 0 9s.347 2.823.957 4.038l3.007-2.332z" fill="#FBBC05"></path>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.443 2.048.957 4.962l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#EA4335"></path>
  </svg>
);

// ponytail: simple password strength (length + variety)
function getStrength(pwd: string) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(4, score);
}

export function SignupForm({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const turnstileRef = useTurnstile(turnstileSiteKey);

  const handleSignUp = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setIsError(false);
    setIsSuccess(false);
    
    let turnstileToken = '';
    const turnstileInput = document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement;
    if (turnstileInput) {
      turnstileToken = turnstileInput.value;
    }

    if (!turnstileToken && turnstileSiteKey) {
      setMessage('Please complete the security check.');
      setIsError(true);
      setIsLoading(false);
      return;
    }

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      fetchOptions: {
        headers: {
          'x-cf-turnstile-response': turnstileToken
        }
      }
    });

    if (error) {
      setMessage(error.message || 'Failed to create account. Try again.');
      setIsError(true);
      if (window.turnstile && turnstileRef.current) {
        window.turnstile.reset();
      }
    } else {
      setMessage('Account created! Redirecting to verification...');
      setIsSuccess(true);
      setTimeout(() => {
        window.location.href = `/verify-email?email=${encodeURIComponent(email)}`;
      }, 1500);
    }
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    });
  };

  const handleGithubSignIn = async () => {
    await authClient.signIn.social({
      provider: 'github',
      callbackURL: '/dashboard',
    });
  };

  return (
    <AuthFormLayout
      title="Create your account"
      description="Start tracking your bills in 2 minutes"
      message={message}
      isError={isError}
      isLoading={isLoading}
      socialProviders={isSuccess ? undefined : [
        { id: 'google', label: 'Continue with Google', icon: <GoogleSVG />, onClick: handleGoogleSignIn },
        { id: 'github', label: 'Continue with GitHub', icon: <GithubSVG />, onClick: handleGithubSignIn },
      ]}
      footerLink={isSuccess ? undefined : { href: '/login', text: 'Already have an account?', linkText: 'Sign in' }}
    >
      {isSuccess ? (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/login" className="btn btn-primary">
            Sign in now
          </a>
        </div>
      ) : (
        <form onSubmit={handleSignUp} method="post" className="flex flex-col gap-5 m-0">
          <TextInput
            id="name"
            label="Full name"
            value={name}
            onChange={setName}
            placeholder="Your name"
            required
            disabled={isLoading}
          />

          <EmailInput
            value={email}
            onChange={setEmail}
            disabled={isLoading}
          />

          <PasswordInput
            value={password}
            onChange={setPassword}
            disabled={isLoading}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            minLength={8}
            hint={
              password.length > 0 ? (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      style={{
                        height: 4,
                        flex: 1,
                        borderRadius: 2,
                        backgroundColor: i <= getStrength(password) 
                          ? (getStrength(password) < 3 ? 'var(--color-warning)' : 'var(--color-success)') 
                          : 'var(--color-border)',
                        transition: 'background-color 200ms'
                      }}
                    />
                  ))}
                </div>
              ) : "Use 8+ characters with letters and numbers"
            }
          />

          {turnstileSiteKey && (
            <div className="flex justify-center py-2">
              <div ref={turnstileRef} className="cf-turnstile"></div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-label-caps text-label-caps text-on-primary bg-primary hover:bg-primary-container hover:text-on-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isLoading ? 'Creating account...' : 'Create account'}
                {!isLoading && (
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                )}
              </span>
            </button>
          </div>
        </form>
      )}
    </AuthFormLayout>
  );
}
