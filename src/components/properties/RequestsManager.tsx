import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { apiClient } from '../../lib/api-client';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Building2 } from 'lucide-react';

type EditRequest = {
  id: string;
  propertyId: string;
  propertyName: string;
  billingPeriodId: string;
  periodMonth: string;
  requestedByName: string;
  requestedAt: string;
  reason: string;
  status: string;
  proposedValues?: Record<string, number | null>;
  currentValues?: Record<string, number | null>;
};

export function RequestsManager() {
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedRequest, setSelectedRequest] = useState<EditRequest | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const { toast } = useToast();

  const fetchRequests = async () => {
    setIsLoading(true);
    const { data } = await apiClient.get<{ pending: EditRequest[], resolvedCount: number }>(`/edit-requests?status=pending`);
    if (data) {
      setRequests(data.pending);
      setResolvedCount(data.resolvedCount);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedRequest) return;
    setIsProcessing(true);

    const { error } = await apiClient.patch(`/edit-requests/${selectedRequest.id}/review`, {
      action,
      rejectionReason: action === 'reject' ? rejectionReason : undefined,
    });

    setIsProcessing(false);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }

    toast({ title: `Request ${action}d`, description: action === 'approve' ? "Bills have been scheduled for recalculation." : "The tenant has been notified." });
    setIsReviewOpen(false);
    setSelectedRequest(null);
    setRejectionReason('');
    fetchRequests();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Edit Requests</h1>
        <p className="text-muted-foreground">
          Review meter reading correction requests submitted by your tenants across all properties.
        </p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground animate-pulse">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl bg-surface/50 text-muted-foreground">
          <div className="w-12 h-12 mb-4 bg-muted rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">No pending edit requests</h3>
          <p className="text-sm max-w-sm">When tenants request changes to their bills, you'll see them here to review and approve.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <div key={request.id} className="p-5 border border-border rounded-xl bg-surface flex flex-col md:flex-row md:items-center justify-between shadow-sm gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground font-medium bg-muted/30 w-fit px-2 py-1 rounded-md">
                  <Building2 className="w-4 h-4" />
                  {request.propertyName}
                </div>
                <div className="font-medium text-foreground flex items-center gap-2">
                  {request.requestedByName} 
                  <span className="text-muted-foreground font-normal">&middot;</span>
                  {new Date(request.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  <Badge variant="pending" className="ml-2">Pending</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  "{request.reason}"
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Requested {new Date(request.requestedAt).toLocaleDateString()}
                </div>
              </div>
              <Button onClick={() => { setSelectedRequest(request); setIsReviewOpen(true); }} className="shrink-0 w-full md:w-auto">
                Review Request
              </Button>
            </div>
          ))}
        </div>
      )}

      {resolvedCount > 0 && (
        <div className="pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {resolvedCount} resolved request{resolvedCount === 1 ? '' : 's'} across your properties
          </p>
        </div>
      )}

      {/* Review Modal */}
      <Dialog open={isReviewOpen} onOpenChange={(open) => { setIsReviewOpen(open); if(!open) setSelectedRequest(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Edit Request</DialogTitle>
            <DialogDescription>
              Review the tenant's request for {selectedRequest?.propertyName} ({selectedRequest ? new Date(selectedRequest.periodMonth).toLocaleString('default', { month: 'long', year: 'numeric' }) : ''}).
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="p-4 bg-muted/50 rounded-md">
              <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Tenant's Reason:</span>
              <p className="mt-1 text-sm text-foreground">{selectedRequest?.reason}</p>
            </div>
            
            {selectedRequest?.proposedValues && selectedRequest?.currentValues && (
              <div className="space-y-2 pt-4 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proposed Changes</p>
                <div className="bg-muted/50 rounded-md p-3 text-sm space-y-2">
                  {['importEnd', 'exportEnd', 'solarGenerationEnd'].map(key => {
                    const current = selectedRequest.currentValues?.[key];
                    const proposed = selectedRequest.proposedValues?.[key];
                    if (proposed === undefined || proposed === null) return null;
                    return (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          {key === 'importEnd' ? 'Grid Import' : key === 'exportEnd' ? 'Grid Export' : 'Solar Generation'}
                        </span>
                        <span>
                          <span className="line-through opacity-60 mr-2">{current}</span>
                          <span className="font-medium">{proposed}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="space-y-2 pt-4 border-t border-border">
              <Label>If rejecting, please provide a reason:</Label>
              <Input 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)} 
                placeholder="Optional explanation for the tenant"
              />
            </div>
          </div>

          <DialogFooter className="flex space-x-2 justify-end">
            <Button variant="outline" onClick={() => setIsReviewOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleReview('reject')} disabled={isProcessing}>
              Reject
            </Button>
            <Button onClick={() => handleReview('approve')} disabled={isProcessing}>
              Approve & Recalculate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
