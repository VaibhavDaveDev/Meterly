import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';

type InviteDetails = {
  propertyName: string;
  propertyAddress: string | null;
  splitPercentage: number | null;
  ownerName: string;
  isExpired: boolean;
  status: string;
  inviteEmail: string;
};

export function InviteAcceptForm({ token }: { token: string }) {
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvite() {
      const { data, error } = await apiClient.get<InviteDetails>(`/invites/${token}`);
      if (error) {
        setError(error.message);
      } else {
        setInvite(data);
      }
      setIsLoading(false);
    }
    fetchInvite();
  }, [token]);

  const handleAction = async (action: 'accept' | 'decline') => {
    setIsProcessing(true);
    setError(null);
    
    const { error } = await apiClient.post(`/invites/${token}/${action}`, {});
    
    setIsProcessing(false);
    
    if (error) {
      setError(error.message || `Failed to ${action} invite.`);
    } else {
      setMessage(`You have successfully ${action}ed the invitation.`);
      if (action === 'accept') {
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      }
    }
  };

  if (isLoading) {
    return <div className="text-center p-8">Loading invitation details...</div>;
  }

  if (error && !invite) {
    return (
      <div className="text-center p-8 space-y-4">
        <h2 className="text-xl font-semibold text-destructive">Invalid or Expired Invite</h2>
        <p className="text-muted-foreground">{error}</p>
        <a href="/dashboard" className="text-primary hover:underline">Go to Dashboard</a>
      </div>
    );
  }

  if (message) {
    return (
      <div className="text-center p-8 space-y-4">
        <h2 className="text-2xl font-semibold text-primary">Done!</h2>
        <p className="text-muted-foreground">{message}</p>
        <a href="/dashboard" className="text-primary hover:underline font-medium">Return to Dashboard →</a>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Property Invitation</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ve been invited to join a property as a tenant.
        </p>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Property</p>
          <p className="font-medium text-lg">{invite?.propertyName}</p>
        </div>
        
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Address</p>
          <p className="text-sm">{invite?.propertyAddress || 'No address provided'}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Split</p>
            <p className="text-sm">{invite?.splitPercentage ? `${invite.splitPercentage}%` : 'Auto (Equal)'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Owner</p>
            <p className="text-sm">{invite?.ownerName}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm font-medium text-destructive text-center">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <button
          onClick={() => handleAction('accept')}
          disabled={isProcessing}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2 w-full"
        >
          {isProcessing ? 'Processing...' : 'Accept Invitation'}
        </button>
        <button
          onClick={() => handleAction('decline')}
          disabled={isProcessing}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full text-destructive"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
