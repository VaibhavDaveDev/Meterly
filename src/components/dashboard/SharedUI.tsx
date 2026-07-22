import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TooltipIcon } from '../ui/tooltip';
import { Maximize2, Minimize2 } from 'lucide-react';
import { formatCurrency } from '../../lib/format';

export function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 flex flex-col justify-center gap-2 min-h-[96px]">
      <div className="skeleton h-3 w-24 rounded" />
      <div className="skeleton h-7 w-32 rounded" />
    </div>
  );
}

export function KpiCard({
  label,
  value,
  subtext,
  tooltip,
  variant = 'default',
  delta,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  tooltip?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  delta?: { value: number; label?: string };
}) {
  const valueColorClass =
    variant === 'success'     ? 'text-emerald-500' :
    variant === 'warning'     ? 'text-amber-500'   :
    variant === 'destructive' ? 'text-red-500'      :
    'text-foreground';

  const bgClass =
    variant === 'success'     ? 'border-emerald-500/20 bg-emerald-500/5' :
    variant === 'warning'     ? 'border-amber-500/20 bg-amber-500/5'     :
    variant === 'destructive' ? 'border-red-500/20 bg-red-500/5'         :
    'border-border bg-surface';

  return (
    <div className={`rounded-xl border p-5 flex flex-col justify-center ${bgClass}`}>
      <div className="flex items-center gap-0.5 mb-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold font-heading">{label}</span>
        {tooltip && <TooltipIcon content={tooltip} />}
      </div>
      <span className={`text-3xl font-bold font-numbers ${valueColorClass}`}>{value}</span>
      {subtext && <span className="text-xs text-muted-foreground mt-1 font-body">{subtext}</span>}
      {delta !== undefined && (
        <span className={`text-xs mt-1 font-numbers ${
          delta.value > 0 ? 'text-amber-500' : delta.value < 0 ? 'text-emerald-500' : 'text-muted-foreground'
        }`}>
          {delta.value > 0 ? '+' : ''}{delta.value.toFixed(1)}% {delta.label ?? 'vs last month'}
        </span>
      )}
    </div>
  );
}

export function ChartCard<T>({ 
  id, 
  title, 
  data, 
  children 
}: { 
  id?: string;
  title: string; 
  data?: T[];
  children: React.ReactNode | ((slicedData: T[]) => React.ReactNode);
}) {
  const [range, setRange] = useState<3 | 6 | 12 | 'all'>(12);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem(`meterly-chart-range-${id}`);
      if (saved === '3' || saved === '6' || saved === '12' || saved === 'all') {
        setRange(saved === 'all' ? 'all' : parseInt(saved) as 3 | 6 | 12);
      }
    }
  }, [id]);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleRangeChange = (r: 3 | 6 | 12 | 'all') => {
    setRange(r);
    if (id) {
      localStorage.setItem(`meterly-chart-range-${id}`, r.toString());
    }
  };

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const slicedData = data
    ? (range === 'all' ? data : data.slice(-range))
    : [];

  const isEmpty = slicedData.length === 0;

  return (
    <div 
      ref={containerRef}
      className={`rounded-xl border border-border bg-surface p-5 flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 rounded-none p-6' : ''}`}
    >
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground font-heading m-0">{title}</h3>
        <div className="flex items-center gap-2">
          {id && data && (
            <div className="flex items-center bg-muted/50 rounded-full p-1 border border-border/50">
              {([3, 6, 12] as const).map(r => (
                <button
                  key={r}
                  onClick={() => handleRangeChange(r)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                    range === r ? 'bg-accent text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {r}M
                </button>
              ))}
              <button
                onClick={() => handleRangeChange('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                  range === 'all' ? 'bg-accent text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                All
              </button>
            </div>
          )}
          <button
            onClick={handleFullscreen}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
      {/* ponytail: in fullscreen, make chart-container flex-col and chart-area flex-1 with explicit min-height to prevent zero height resolution in ResponsiveContainer */}
      <div className={`flex-1 w-full chart-container ${isFullscreen ? 'min-h-0 flex-1 flex flex-col' : 'min-h-[240px]'}`}>
        <div className={`chart-area w-full ${isFullscreen ? 'flex-1' : ''}`} style={{ height: isFullscreen ? undefined : 240, minHeight: 240 }}>
          {isEmpty && data !== undefined ? (
            <div className="flex h-full min-h-[240px] items-center justify-center">
              <p className="text-sm text-muted-foreground">No data for this period.</p>
            </div>
          ) : (
            typeof children === 'function' ? children(slicedData) : children
          )}
        </div>
      </div>
    </div>
  );
}

export function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-wider text-muted-foreground font-heading">
      {children}
    </h2>
  );
}

export const CHART_COLORS = ['#10b981', '#F59E0B', '#064E3B', '#EF4444', '#94a3b8', '#06b6d4'];

export const TOOLTIP_STYLE = {
  backgroundColor: 'var(--card)',
  borderColor: 'var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
  color: 'var(--foreground)',
} as const;

export function DashboardCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface ${className}`}>
      {children}
    </div>
  );
}

export interface MomComparisonRow {
  label: string;
  lastMonthValue: number;
  thisMonthValue: number;
  format: 'currency' | 'units';
  invertColors?: boolean; // if true, higher is bad (amber), lower is good (emerald)
}

export function MomComparisonTable({ rows }: { rows: MomComparisonRow[] }) {
  return (
    <DashboardCard className="p-5 overflow-hidden">
      <SectionHeading>Month-on-Month Comparison</SectionHeading>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Metric</th>
              <th className="pb-2 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Last Month</th>
              <th className="pb-2 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">This Month</th>
              <th className="pb-2 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => {
              const change = row.lastMonthValue > 0 ? ((row.thisMonthValue - row.lastMonthValue) / row.lastMonthValue) * 100 : null;
              
              let changeColor = 'text-muted-foreground';
              if (change !== null) {
                if (change > 0) changeColor = row.invertColors ? 'text-amber-500' : 'text-emerald-500';
                else if (change < 0) changeColor = row.invertColors ? 'text-emerald-500' : 'text-amber-500';
              }

              const isGood = change !== null && (row.invertColors ? change < 0 : change > 0);
              
              const fmt = (val: number) => row.format === 'currency' ? formatCurrency(val) : `${val} kWh`;

              return (
                <tr key={i}>
                  <td className="py-3 font-medium text-foreground">{row.label}</td>
                  <td className="py-3 font-numbers">{fmt(row.lastMonthValue)}</td>
                  <td className={`py-3 font-numbers ${isGood ? 'text-emerald-500 font-semibold' : ''}`}>{fmt(row.thisMonthValue)}</td>
                  <td className={`py-3 font-numbers ${changeColor}`}>
                    {change !== null ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
