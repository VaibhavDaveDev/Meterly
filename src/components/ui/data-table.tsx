import { cn } from '../../lib/utils';

// ── Column definition ─────────────────────────────────────────────────────────

type ColumnDef<T> = {
  header: string;
  /** String key on row, or render function */
  accessor: keyof T | ((row: T) => React.ReactNode);
  align?: 'left' | 'right' | 'center';
  /** Extra classes on td */
  className?: string;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Render function for hover-revealed row actions */
  rowActions?: (row: T) => React.ReactNode;
  loading?: boolean;
  /** Skeleton row count while loading */
  skeletonRows?: number;
  emptyState?: React.ReactNode;
  className?: string;
  /** Called when a row is clicked (optional) */
  onRowClick?: (row: T) => void;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonRows({ cols, rows }: { cols: number; rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="border-b border-border">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3">
              <div className="skeleton h-4 rounded" style={{ width: ci === 0 ? '60%' : '40%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowActions,
  loading = false,
  skeletonRows = 4,
  emptyState,
  className,
  onRowClick,
}: DataTableProps<T>) {
  const colCount = columns.length + (rowActions ? 1 : 0);

  function getCellValue(row: T, col: ColumnDef<T>): React.ReactNode {
    if (typeof col.accessor === 'function') return col.accessor(row);
    const val = row[col.accessor as keyof T];
    return val as React.ReactNode;
  }

  function alignClass(align?: 'left' | 'right' | 'center') {
    if (align === 'right') return 'text-right font-numbers';
    if (align === 'center') return 'text-center';
    return 'text-left';
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm text-left">
        {/* Header */}
        <thead className="border-b border-border">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className={cn(
                  'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                  alignClass(col.align)
                )}
              >
                {col.header}
              </th>
            ))}
            {rowActions && (
              <th className="px-4 py-3 w-px" aria-label="Actions" />
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {loading ? (
            <SkeletonRows cols={colCount} rows={skeletonRows} />
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-10 text-center text-muted-foreground text-sm">
                {emptyState ?? 'No data.'}
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
              <tr
                key={ri}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'group transition-colors hover:bg-surface-raised/60',
                  onRowClick && 'cursor-pointer',
                  ri % 2 === 1 && 'bg-surface-raised/20'
                )}
              >
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      'px-4 py-3',
                      alignClass(col.align),
                      col.className
                    )}
                  >
                    {getCellValue(row, col)}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-3 text-right">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
                      {rowActions(row)}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
