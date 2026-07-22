import { Button } from '../ui/button';
import { AlertCircle } from 'lucide-react';

interface SubmitConfirmDialogProps {
  photoCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitConfirmDialog({ photoCount, onConfirm, onCancel }: SubmitConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-border p-6 max-w-md w-full space-y-4 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Ready to Submit?
            </h3>
            <p className="text-sm text-muted-foreground">
              You have {photoCount} photo{photoCount > 1 ? 's' : ''} attached to this submission.
              These will be saved with your meter readings.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              You can remove photos by clicking the X on each photo thumbnail.
            </p>
          </div>
        </div>
        
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} type="button">
            Go Back
          </Button>
          <Button onClick={onConfirm} type="button">
            Submit Readings
          </Button>
        </div>
      </div>
    </div>
  );
}
