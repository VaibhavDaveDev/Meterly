import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-semibold uppercase tracking-wider rounded border text-xs px-2 py-0.5',
  {
    variants: {
      variant: {
        // Semantic states
        success:     'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        warning:     'bg-amber-500/10 text-amber-500 border-amber-500/20',
        destructive: 'bg-red-500/10 text-red-500 border-red-500/20',
        info:        'bg-blue-500/10 text-blue-400 border-blue-500/20',
        muted:       'bg-surface-raised text-muted-foreground border-border',

        // Role badges
        owner:  'bg-accent/10 text-accent border-accent/20',
        tenant: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',

        // Status aliases (convenience)
        paid:    'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        unpaid:  'bg-red-500/10 text-red-500 border-red-500/20',
        pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        active:  'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        invited: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      },
    },
    defaultVariants: {
      variant: 'muted',
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}
