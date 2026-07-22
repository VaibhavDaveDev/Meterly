import { useEffect, useState } from 'react';
import { X, Eye, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useToast } from '../../hooks/use-toast';

interface Photo {
  id: string;
  objectKey: string;
  purpose: string;
  uploadedAt: string;
}

interface UploadedPhotosProps {
  periodId: string;
  onDelete?: (photoId: string) => void;
  canDelete?: boolean;
}

export function UploadedPhotos({ periodId, onDelete, canDelete = false }: UploadedPhotosProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/uploads/bill-photos?periodId=${periodId}`)
      .then(res => res.json() as Promise<{ success: boolean; data: Photo[] }>)
      .then((data) => {
        if (data.success) {
          setPhotos(data.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [periodId]);

  // ponytail: use custom ConfirmDialog and useToast to replace native alert/confirm dialogs
  const handleDelete = (photoId: string) => {
    setPhotoToDelete(photoId);
  };

  const confirmDelete = async () => {
    if (!photoToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/uploads/bill-photo/${photoToDelete}`, { method: 'DELETE' });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      
      if (json.success) {
        setPhotos(photos.filter(p => p.id !== photoToDelete));
        onDelete?.(photoToDelete);
        toast({
          title: 'Photo deleted',
          description: 'The photo has been removed successfully.',
        });
      } else {
        toast({
          title: 'Failed to delete photo',
          description: json.error?.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setPhotoToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (photos.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Uploaded Photos</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map(photo => (
          <div key={photo.id} className="relative group">
            <div className="aspect-square rounded-lg border border-border overflow-hidden bg-muted/20">
              <img
                src={`/api/uploads/bill-photo/${photo.objectKey}`}
                alt="Bill photo"
                className="w-full h-full object-cover"
              />
            </div>
            {/* ponytail: keep overlay action buttons always visible on mobile devices (no hover state) */}
            <div className="absolute inset-0 bg-black/40 sm:bg-black/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setViewing(photo.objectKey)}
                type="button"
              >
                <Eye className="w-4 h-4" />
              </Button>
              {canDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(photo.id)}
                  type="button"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Full size viewer */}
      {viewing && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          <img
            src={`/api/uploads/bill-photo/${viewing}`}
            alt="Bill photo full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            className="absolute top-4 right-4"
            variant="secondary"
            onClick={() => setViewing(null)}
            type="button"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Custom confirm delete dialog */}
      <ConfirmDialog
        isOpen={photoToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPhotoToDelete(null);
        }}
        title="Delete Photo"
        description="Are you sure you want to delete this photo? This action cannot be undone."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
