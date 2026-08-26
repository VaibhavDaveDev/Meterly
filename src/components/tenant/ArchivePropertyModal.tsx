import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Checkbox } from "../ui/checkbox";

interface ArchivePropertyModalProps {
  isOpen: boolean;
  propertyName: string;
  allPaid: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ArchivePropertyModal({
  isOpen,
  propertyName,
  allPaid,
  onConfirm,
  onCancel,
}: ArchivePropertyModalProps) {
  const [unpaidChecked, setUnpaidChecked] = React.useState(false);

  // Reset checkbox when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setUnpaidChecked(false);
    }
  }, [isOpen]);

  const needsUnpaidCheck = !allPaid;
  const isConfirmDisabled = needsUnpaidCheck && !unpaidChecked;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-6 border border-border bg-surface p-6 shadow-xl rounded-xl animate-in fade-in zoom-in-95 font-body">
          <div className="flex flex-col space-y-2 text-center sm:text-left">
            <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground font-heading pr-8">
              {needsUnpaidCheck ? "Unpaid bills remain" : "Hide property"}
            </Dialog.Title>
            <Dialog.Description asChild>
              <div className="text-sm text-muted-foreground space-y-4">
                <p className="m-0">
                  {needsUnpaidCheck
                    ? `You have unpaid bill(s) at ${propertyName}. Hiding this property does not cancel your bills.`
                    : `Hiding ${propertyName} moves it to "Hidden Properties".`}
                </p>
              </div>
            </Dialog.Description>
          </div>

          {needsUnpaidCheck && (
            <div className="flex items-center space-x-3 bg-muted/30 p-3 rounded-lg border border-border/50">
              <Checkbox
                id="unpaid-check"
                checked={unpaidChecked}
                onCheckedChange={(checked: boolean) =>
                  setUnpaidChecked(checked)
                }
              />
              <label
                htmlFor="unpaid-check"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground cursor-pointer"
              >
                I understand my bills are not cancelled
              </label>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0">
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-border bg-transparent hover:bg-surface-raised px-4 py-2"
            >
              Keep visible
            </button>
            <button
              onClick={onConfirm}
              disabled={isConfirmDisabled}
              className="inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring px-4 py-2 shadow-sm bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:bg-foreground"
            >
              Hide anyway
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
