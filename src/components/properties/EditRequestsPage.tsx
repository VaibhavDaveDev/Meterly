import { useState, useEffect } from 'react';
import { useToast } from '../../hooks/use-toast';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Loader2, ArrowLeft, Check, X, MessageSquare, Clock, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';

interface EditRequest {
  id: string;
  billingPeriodId: string;
  periodMonth: string;
  periodStatus?: string;
  requestedByName: string;
  requestedAt: string;
  reason: string;
  proposedValues: Record<string, number | null>;
  currentValues: Record<string, number | null>;
  impactSummary: {
    unitsDelta: number;
    billDelta: number;
  };
  status: 'pending' | 'approved' | 'rejected';
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
}

interface EditRequestsPageProps {
  propertyId: string;
}

function ReadingComparison({ 
  current, 
  proposed, 
  label 
}: { 
  current: number | null | undefined; 
  proposed: number | null | undefined; 
  label: string; 
}) {
  if (proposed === undefined || proposed === null) return null;
  
  const currentNum = current ?? 0;
  const proposedNum = proposed;
  const hasChanged = proposedNum !== currentNum;
  const delta = proposedNum - currentNum;
  
  if (!hasChanged) {
    return (
      <div className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{currentNum} units</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-between p-2 bg-amber-500/10 border border-amber-500/30 rounded text-sm animate-fade-in">
      <span className="font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-muted-foreground line-through">{currentNum}</span>
        <ArrowRight className="w-4 h-4 text-amber-500" />
        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{proposedNum}</span>
        <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          ({delta > 0 ? '+' : ''}{delta})
        </span>
      </div>
    </div>
  );
}

export function EditRequestsPage({ propertyId }: EditRequestsPageProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState<EditRequest[]>([]);
  const [resolved, setResolved] = useState<EditRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvedExpanded, setIsResolvedExpanded] = useState(false);

  // Review state
  const [selectedRequest, setSelectedRequest] = useState<EditRequest | null>(null);
  const [requestToApprove, setRequestToApprove] = useState<EditRequest | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/edit-requests`);
      const json = await res.json() as { success: boolean; data: { pending: EditRequest[]; resolved: EditRequest[] }; error?: { message: string } };
      if (json.success) {
        setPending(json.data.pending);
        setResolved(json.data.resolved);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error?.message || 'Failed to load requests' });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [propertyId]);

  const handleApprove = (request: EditRequest) => {
    setRequestToApprove(request);
  };

  const confirmApprove = async () => {
    if (!requestToApprove) return;
    const req = requestToApprove;
    setRequestToApprove(null);
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/edit-requests/${req.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const json = await res.json() as { success: boolean; error?: { message: string } };
      
      if (json.success) {
        toast({ title: 'Success', description: 'Request approved and recalculation queued' });
        fetchRequests();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error?.message });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to approve' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedRequest) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/edit-requests/${selectedRequest.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectionReason }),
      });
      const json = await res.json() as { success: boolean; error?: { message: string } };
      
      if (json.success) {
        toast({ title: 'Success', description: 'Request rejected' });
        setIsRejectModalOpen(false);
        setRejectionReason('');
        fetchRequests();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error?.message });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to reject' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Edit Requests</h1>
          <p className="text-muted-foreground">Manage tenant-requested corrections</p>
        </div>
        {pending.length > 0 && (
          <Badge variant="warning" className="ml-auto text-sm px-3 py-1 rounded-full">
            {pending.length} pending
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {pending.length === 0 ? (
          <div className="border border-border border-dashed rounded-xl bg-muted/30">
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 p-6">
              <Check className="w-12 h-12 text-muted-foreground/50" />
              <div className="space-y-1">
                <p className="font-medium">No pending requests</p>
                <p className="text-sm text-muted-foreground">Tenants can request corrections from their bill page.</p>
              </div>
            </div>
          </div>
        ) : (
          pending.map(request => (
            <div key={request.id} className="border border-border rounded-xl bg-card text-card-foreground shadow-sm">
              <div className="p-6 pb-4 bg-muted/20 rounded-t-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium leading-none tracking-tight">{request.requestedByName}</h3>
                      {request.periodStatus === 'confirmed' && (
                        <Badge variant="warning" className="text-amber-600 border-amber-600/30 bg-amber-50 dark:bg-amber-950/20 text-xs py-0.5 px-2">
                          Confirmed Period
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                      <Clock className="w-3.5 h-3.5" />
                      {request.periodMonth} &middot; {new Date(request.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 pt-6 space-y-6">
                <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3 text-sm">
                  <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="italic text-foreground/80">&quot;{request.reason}&quot;</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Proposed Change</h4>
                  <div className="bg-card border rounded-md p-4 space-y-2">
                    <ReadingComparison 
                      current={request.currentValues.importEnd} 
                      proposed={request.proposedValues.importEnd} 
                      label="Import from Grid" 
                    />
                    <ReadingComparison 
                      current={request.currentValues.exportEnd} 
                      proposed={request.proposedValues.exportEnd} 
                      label="Export to Grid" 
                    />
                    <ReadingComparison 
                      current={request.currentValues.solarGenerationEnd} 
                      proposed={request.proposedValues.solarGenerationEnd} 
                      label="Solar Generation" 
                    />
                    
                    <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Net Impact</span>
                      <Badge variant={request.impactSummary.unitsDelta > 0 ? 'warning' : 'success'}>
                        {request.impactSummary.unitsDelta > 0 ? '+' : ''}{request.impactSummary.unitsDelta} units
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 bg-muted/10 border-t p-4 rounded-b-xl">
                <Button 
                  variant="outline"  
                  onClick={() => {
                    setSelectedRequest(request);
                    setIsRejectModalOpen(true);
                  }}
                  disabled={isSubmitting}
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button 
                  onClick={() => handleApprove(request)}
                  disabled={isSubmitting}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {resolved.length > 0 && (
        <div className="pt-8">
          <Button 
            variant="ghost" 
            className="w-full flex justify-between items-center py-6 text-muted-foreground hover:bg-muted/50"
            onClick={() => setIsResolvedExpanded(!isResolvedExpanded)}
          >
            <span className="font-medium text-lg">Resolved Requests ({resolved.length})</span>
            {isResolvedExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>

          {isResolvedExpanded && (
            <div className="mt-4 space-y-4">
              {resolved.map(request => (
                <div key={request.id} className="border border-border rounded-xl bg-card text-card-foreground shadow-sm opacity-75 hover:opacity-100 transition-opacity">
                  <div className="p-6 py-4 flex flex-row items-center justify-between">
                    <div>
                      <h3 className="text-base font-medium leading-none tracking-tight">{request.requestedByName}</h3>
                      <p className="text-sm text-muted-foreground mt-2">{request.periodMonth}</p>
                    </div>
                    <Badge variant={request.status === 'approved' ? 'success' : 'destructive'}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="p-6 py-0 pb-4 text-sm text-muted-foreground space-y-2">
                    <p className="italic">&quot;{request.reason}&quot;</p>
                    {request.reviewNote && (
                      <div className="bg-muted p-3 rounded-md mt-2">
                        <span className="font-medium text-foreground">Note:</span> {request.reviewNote}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Edit Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this edit. The tenant will be notified.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-2">
            <textarea 
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="E.g., The provided reading seems lower than last month's."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value.slice(0, 500))}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {rejectionReason.length} / 500 characters
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectSubmit} disabled={isSubmitting || !rejectionReason.trim()}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Modal */}
      <Dialog open={!!requestToApprove} onOpenChange={(open) => !open && setRequestToApprove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Edit Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this edit for {requestToApprove && new Date(requestToApprove.periodMonth + 'T00:00:00Z').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}? The bill will be recalculated and the tenant will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestToApprove(null)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={confirmApprove} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
