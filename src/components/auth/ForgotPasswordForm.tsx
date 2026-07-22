import React, { type SubmitEvent } from 'react';
import { useTurnstile } from '../../hooks/use-turnstile';
import { AuthFormLayout } from './AuthFormLayout';
import { useForgotPassword } from '../../hooks/use-forgot-password';
import { EmailInput, PasswordInput } from './AuthInputs';

interface EmailStepProps {
  email: string;
  setEmail: (val: string) => void;
  isLoading: boolean;
  handleSendOTP: (e: SubmitEvent<HTMLFormElement>) => Promise<void>;
  turnstileSiteKey?: string;
  turnstileRef: React.RefObject<HTMLDivElement | null>;
}

function EmailStep({
  email,
  setEmail,
  isLoading,
  handleSendOTP,
  turnstileSiteKey,
  turnstileRef,
}: EmailStepProps) {
  return (
    <form onSubmit={handleSendOTP} method="post" className="space-y-5">
      <EmailInput
        value={email}
        onChange={setEmail}
        disabled={isLoading}
      />

      {turnstileSiteKey && (
        <div className="flex justify-center py-2">
          <div ref={turnstileRef} className="cf-turnstile"></div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-label-caps text-label-caps text-on-primary bg-primary hover:bg-primary-container hover:text-on-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Sending code...' : 'Send verification code'}
      </button>
    </form>
  );
}

interface OtpStepProps {
  email: string;
  otp: string;
  setOtp: (val: string) => void;
  isLoading: boolean;
  handleVerifyOTP: (e: SubmitEvent<HTMLFormElement>) => Promise<void>;
  setStep: (step: 'email' | 'otp' | 'reset') => void;
}

function OtpStep({
  email,
  otp,
  setOtp,
  isLoading,
  handleVerifyOTP,
  setStep,
}: OtpStepProps) {
  return (
    <form onSubmit={handleVerifyOTP} method="post" className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="otp" className="text-sm font-medium">
          Verification code
        </label>
        <input
          id="otp"
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          required
          disabled={isLoading}
          maxLength={6}
          style={{ fontFamily: 'monospace' }}
          className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-lg text-center text-2xl tracking-widest text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-on-surface-variant text-center">
          Code sent to {email}
        </p>
        <p className="text-xs text-on-surface-variant text-center mt-1">
          If you don&apos;t see it, please check your spam folder.
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading || otp.length !== 6}
        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-label-caps text-label-caps text-on-primary bg-primary hover:bg-primary-container hover:text-on-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Verifying...' : 'Verify code'}
      </button>

      <button
        type="button"
        onClick={() => setStep('email')}
        disabled={isLoading}
        className="w-full px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors font-medium"
      >
        Use a different email
      </button>
    </form>
  );
}

interface ResetStepProps {
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  isLoading: boolean;
  showNewPassword: boolean;
  setShowNewPassword: (val: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (val: boolean) => void;
  handleResetPassword: (e: SubmitEvent<HTMLFormElement>) => Promise<void>;
}

function ResetStep({
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  isLoading,
  showNewPassword,
  setShowNewPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  handleResetPassword,
}: ResetStepProps) {
  return (
    <form onSubmit={handleResetPassword} method="post" className="space-y-5">
      <PasswordInput
        id="newPassword"
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        disabled={isLoading}
        showPassword={showNewPassword}
        setShowPassword={setShowNewPassword}
        minLength={8}
      />

      <PasswordInput
        id="confirmPassword"
        label="Confirm new password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        disabled={isLoading}
        showPassword={showConfirmPassword}
        setShowPassword={setShowConfirmPassword}
        placeholder="Re-enter password"
        minLength={8}
        hint={
          confirmPassword && newPassword !== confirmPassword ? (
            <span className="text-error">Passwords do not match</span>
          ) : undefined
        }
      />

      <button
        type="submit"
        disabled={isLoading || newPassword !== confirmPassword || newPassword.length < 8}
        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-label-caps text-label-caps text-on-primary bg-primary hover:bg-primary-container hover:text-on-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Resetting password...' : 'Reset password'}
      </button>
    </form>
  );
}

export function ForgotPasswordForm({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const {
    step,
    setStep,
    email,
    setEmail,
    otp,
    setOtp,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isLoading,
    message,
    isError,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handleSendOTP,
    handleVerifyOTP,
    handleResetPassword,
  } = useForgotPassword({ turnstileSiteKey });

  const turnstileRef = useTurnstile(turnstileSiteKey);

  const getTitles = () => {
    switch (step) {
      case 'email':
        return {
          title: 'Reset your password',
          description: 'Enter your email to receive a verification code',
        };
      case 'otp':
        return {
          title: 'Verify your email',
          description: 'Enter the code we sent to your email',
        };
      case 'reset':
        return {
          title: 'Create new password',
          description: 'Choose a new password for your account',
        };
    }
  };

  const { title, description } = getTitles();

  return (
    <AuthFormLayout
      title={title}
      description={description}
      backToLink={{ href: '/login', label: 'Back to sign in' }}
      message={message}
      isError={isError}
      isLoading={isLoading}
    >
      {step === 'email' && (
        <EmailStep
          email={email}
          setEmail={setEmail}
          isLoading={isLoading}
          handleSendOTP={handleSendOTP}
          turnstileSiteKey={turnstileSiteKey}
          turnstileRef={turnstileRef}
        />
      )}

      {step === 'otp' && (
        <OtpStep
          email={email}
          otp={otp}
          setOtp={setOtp}
          isLoading={isLoading}
          handleVerifyOTP={handleVerifyOTP}
          setStep={setStep}
        />
      )}

      {step === 'reset' && (
        <ResetStep
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          isLoading={isLoading}
          showNewPassword={showNewPassword}
          setShowNewPassword={setShowNewPassword}
          showConfirmPassword={showConfirmPassword}
          setShowConfirmPassword={setShowConfirmPassword}
          handleResetPassword={handleResetPassword}
        />
      )}
    </AuthFormLayout>
  );
}
