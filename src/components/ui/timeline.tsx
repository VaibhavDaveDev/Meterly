import { cn } from '../../lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export type TimelineVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info';

export interface TimelineItem {
  id?: string;
  timestamp: string;
  title: string;
  description?: string;
  /** Optional monospace diff block — rendered as key→value pairs */
  diff?: { key: string; old: string; new: string }[];
  /** Small text shown under the avatar circle */
  author?: string;
  variant?: TimelineVariant;
}

// ── Variant style map ─────────────────────────────────────────────────────────

const nodeVariants: Record<TimelineVariant, string> = {
  default:     'bg-surface-raised border-border',
  success:     'bg-emerald-500/10 border-emerald-500/30',
  warning:     'bg-amber-500/10 border-amber-500/30',
  destructive: 'bg-red-500/10 border-red-500/30',
  info:        'bg-blue-500/10 border-blue-500/30',
};

const dotVariants: Record<TimelineVariant, string> = {
  default:     'bg-border',
  success:     'bg-emerald-500',
  warning:     'bg-amber-500',
  destructive: 'bg-red-500',
  info:        'bg-blue-400',
};

// ── Icon per variant ──────────────────────────────────────────────────────────

function NodeIcon({ variant }: { variant: TimelineVariant }) {
  const size = 'w-3 h-3';
  if (variant === 'success') return (
    <svg className={cn(size, 'text-emerald-500')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
  if (variant === 'warning') return (
    <svg className={cn(size, 'text-amber-500')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4" /><circle cx="12" cy="16" r="0.5" fill="currentColor" />
    </svg>
  );
  if (variant === 'destructive') return (
    <svg className={cn(size, 'text-red-500')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
  if (variant === 'info') return (
    <svg className={cn(size, 'text-blue-400')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16v-4" /><circle cx="12" cy="8" r="0.5" fill="currentColor" />
    </svg>
  );
  return <div className={cn('w-2 h-2 rounded-full', dotVariants[variant])} />;
}

// ── Timeline component ────────────────────────────────────────────────────────

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  if (!items.length) return null;

  return (
    <div className={cn('relative', className)}>
      {/* Vertical connector line */}
      <div
        className="absolute left-[14px] top-2 bottom-2 w-px bg-border"
        aria-hidden="true"
      />

      <div className="space-y-5">
        {items.map((item, idx) => {
          const variant = item.variant ?? 'default';

          return (
            <div key={item.id ?? idx} className="relative flex gap-4">
              {/* Node circle */}
              <div
                className={cn(
                  'flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center z-10',
                  nodeVariants[variant]
                )}
                aria-hidden="true"
              >
                <NodeIcon variant={variant} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5 pb-1">
                <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-2">
                  <p className="text-sm font-semibold text-foreground leading-tight">{item.title}</p>
                  <time className="text-xs text-muted-foreground whitespace-nowrap sm:ml-auto">
                    {item.timestamp}
                  </time>
                </div>

                {item.author && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.author}</p>
                )}

                {item.description && (
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                )}

                {item.diff && item.diff.length > 0 && (
                  <div className="mt-2 rounded-md bg-surface-raised border border-border p-3 text-xs font-mono space-y-1">
                    {item.diff.map((d, di) => (
                      <div key={di} className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground w-28 shrink-0 truncate">{d.key}:</span>
                        <span className="line-through text-red-400">{d.old}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-emerald-500">{d.new}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
