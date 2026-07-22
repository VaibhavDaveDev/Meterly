import React, { type SubmitEvent } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

interface TableActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: string;
  title: string;
  description: string;
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  children: React.ReactNode;
}

export function TableActionDialog({
  open,
  onOpenChange,
  triggerLabel,
  title,
  description,
  onSubmit,
  submitLabel,
  submittingLabel,
  isSubmitting,
  isSubmitDisabled,
  children
}: TableActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {children}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || isSubmitDisabled}>
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
