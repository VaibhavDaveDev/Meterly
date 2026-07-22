import { useState, type SubmitEvent } from 'react';
import { authClient } from '../lib/auth-client';

export interface UseForgotPasswordProps {
  turnstileSiteKey?: string;
}

export function useForgotPassword({ turnstileSiteKey }: UseForgotPasswordProps = {}) {
  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSendOTP = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setIsError(false);

    let turnstileToken = '';
    const turnstileInput = document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement;
    if (turnstileInput) turnstileToken = turnstileInput.value;

    if (!turnstileToken && turnstileSiteKey) {
      setMessage('Please complete the security check.');
      setIsError(true);
      setIsLoading(false);
      return;
    }

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'forget-password',
      fetchOptions: { headers: { 'x-cf-turnstile-response': turnstileToken } },
    });

    if (error) {
      setMessage(error.message || 'Failed to send reset code.');
      setIsError(true);
      if (window.turnstile) window.turnstile.reset();
    } else {
      setStep('otp');
      setMessage('Check your email for the verification code. Be sure to check your spam folder too.');
      setIsError(false);
    }
    setIsLoading(false);
  };

  const handleVerifyOTP = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setIsError(false);

    const { error } = await authClient.emailOtp.checkVerificationOtp({
      email,
      otp,
      type: 'forget-password',
    });

    if (error) {
      setMessage(error.message || 'Invalid or expired code.');
      setIsError(true);
    } else {
      setStep('reset');
      setMessage('');
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      setIsError(true);
      return;
    }

    if (newPassword.length < 8) {
      setMessage('Password must be at least 8 characters.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setMessage('');
    setIsError(false);

    const { error } = await authClient.emailOtp.resetPassword({
      email,
      otp,
      password: newPassword,
    });

    if (error) {
      setMessage(error.message || 'Failed to reset password.');
      setIsError(true);
    } else {
      setMessage('Password reset successfully. Redirecting...');
      setIsError(false);
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
    setIsLoading(false);
  };

  return {
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
  };
}
