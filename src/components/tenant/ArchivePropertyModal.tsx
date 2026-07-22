import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Checkbox } from "../ui/checkbox";

interface ArchivePropertyModalProps {
  isOpen: boolean;
  propertyName: string;
  isPropertyDeleted: boolean;  // true → data may be permanently deleted
  allPaid: boolean;            // false → show unpaid bills warning
  onConfirm: () => void;
  onCancel: () => void;
}

export function ArchivePropertyModal({
  isOpen,
  propertyName,
  isPropertyDeleted,
  allPaid,
  onConfirm,
  onCancel,
}: ArchivePropertyModalProps) {
  const [unpaidChecked, setUnpaidChecked] = React.useState(false);
  const [deletionChecked, setDeletionChecked] = React.useState(false);

  // Reset checkboxes when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setUnpaidChecked(false);
      setDeletionChecked(false);
    }
  }, [isOpen]);

  const needsUnpaidCheck = !allPaid;
  const needsDeletionCheck = isPropertyDeleted;

  const isConfirmDisabled = 
    (needsUnpaidCheck && !unpaidChecked) || 
    (needsDeletionCheck && !deletionChecked);

  let title = "";
  if (needsUnpaidCheck && needsDeletionCheck) {
    title = "Unpaid bills and permanent deletion";
  } else if (needsDeletionCheck) {
    title = "This will permanently delete your billing records";
  } else if (needsUnpaidCheck) {
    title = "Unpaid bills remain";
  }

  const confirmText = needsDeletionCheck ? "Delete and hide" : "Hide anyway";
  const cancelText = needsDeletionCheck ? "Keep my records" : "Keep visible";

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-6 border border-border bg-surface p-6 shadow-xl rounded-xl animate-in fade-in zoom-in-95 font-body">
          <div className="flex flex-col space-y-2 text-center sm:text-left">
            <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground font-heading pr-8">
              {title}
            </Dialog.Title>
            <Dialog.Description asChild>
              <div className="text-sm text-muted-foreground space-y-4">
                {needsUnpaidCheck && (
                  <p className="m-0">
                    You have unpaid bill(s) at {propertyName}. Hiding this property does not cancel the bills — your landlord can still contact you about them.
                  </p>
                )}
                {needsDeletionCheck && (
                  <p className="m-0">
                    The owner has closed this property. When you hide it, all your bills, meter readings, and uploaded photos for {propertyName} will be permanently deleted from our servers. <strong className="text-foreground">This cannot be undone.</strong>
                  </p>
                )}
              </div>
            </Dialog.Description>
          </div>

          <div className="flex flex-col gap-3 py-2">
            {needsUnpaidCheck && (
              <div className="flex items-center space-x-3 bg-muted/30 p-3 rounded-lg border border-border/50">
                <Checkbox
                  id="unpaid-check"
                  checked={unpaidChecked}
                  onCheckedChange={(checked: boolean) => setUnpaidChecked(checked)}
                />
                <label
                  htmlFor="unpaid-check"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground cursor-pointer"
                >
                  I understand my bills are not cancelled
                </label>
              </div>
            )}
            
            {needsDeletionCheck && (
              <div className="flex items-center space-x-3 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                <Checkbox
                  id="deletion-check"
                  checked={deletionChecked}
                  onCheckedChange={(checked: boolean) => setDeletionChecked(checked)}
                />
                <label
                  htmlFor="deletion-check"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-red-600 dark:text-red-400 cursor-pointer"
                >
                  I understand my billing records will be permanently deleted
                </label>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0">
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-border bg-transparent hover:bg-surface-raised px-4 py-2"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isConfirmDisabled}
              className={`inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring px-4 py-2 shadow-sm ${
                needsDeletionCheck 
                  ? "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:bg-red-600" 
                  : "bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:bg-foreground"
              }`}
            >
              {confirmText}
            </button>
          </div>
          
          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
