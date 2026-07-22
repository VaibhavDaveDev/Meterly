import { formatCurrency } from '../../lib/format';
import type { PendingInvite, OwnerDashboardStats, TenantDashboardStats } from './types';
import { OwnerDashboard } from './OwnerDashboard';
import { TenantDashboard } from './TenantDashboard';
import { KpiSkeleton } from './SharedUI';
import { Badge } from '../ui/badge';
import { useDashboardData } from '../../hooks/use-dashboard-data';

function getGreeting(name: string): string {
  const h = new Date().getHours();
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = name.split(' ')[0];
  return `${salutation}, ${firstName} 👋🏻`;
}

export function DashboardOverview() {
  const {
    user,
    invites,
    ownerStats,
    tenantStats,
    loading,
    error,
    activeView,
    setActiveView,
    setOwnerStats,
  } = useDashboardData();

  if (loading) {
    return (
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div>
          <div className="skeleton h-7 w-32 rounded mb-2" />
          <div className="skeleton h-4 w-52 rounded" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <KpiSkeleton key={i} />)}
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <div className="skeleton h-64 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-500 m-0">Failed to load: {error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-secondary mt-4">Retry</button>
      </div>
    );
  }

  const isEmptyOwner = user?.primaryRole === 'owner' && (!ownerStats || ownerStats.totalProperties === 0);
  const isEmptyTenant = user?.primaryRole === 'tenant' && (!tenantStats || tenantStats.activeTenancies.length === 0) && invites.length === 0;

  if (isEmptyOwner || isEmptyTenant) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1 font-heading">
          {user?.name ? getGreeting(user.name) : 'Overview'}
        </h1>
        <p className="text-[0.9375rem] text-muted-foreground mb-10">Welcome to Meterly.</p>
        <div className="border border-border rounded-xl p-12 text-center max-w-lg mx-auto bg-surface">
          {user?.primaryRole === 'tenant' ? (
            <>
              <p className="text-base font-semibold mb-2 font-heading">Waiting for an invite</p>
              <p className="text-[0.9375rem] text-muted-foreground m-0">Your landlord needs to invite you from their Meterly account.</p>
              <p className="text-[0.875rem] text-muted-foreground mt-6 mb-4 border-t border-border pt-6">Are you also a property owner?</p>
              <a href="/properties/new" className="btn btn-secondary inline-flex items-center text-sm font-semibold">Add a property</a>
            </>
          ) : (
            <>
              <p className="text-base font-semibold mb-2 font-heading">No properties yet</p>
              <p className="text-[0.9375rem] text-muted-foreground mb-6">Add a property to start tracking meter readings and bills.</p>
              <a href="/properties/new" className="btn btn-primary inline-flex items-center text-sm font-semibold">Add your first property</a>
            </>
          )}
        </div>
      </div>
    );
  }

  const isBoth = user?.primaryRole === 'both';

  return (
    <div className="flex flex-col gap-10 max-w-6xl mx-auto pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 font-heading">
            {user?.name ? getGreeting(user.name) : 'Overview'}
          </h1>
          <p className="text-muted-foreground m-0 text-sm font-body">Your properties and performance at a glance.</p>
        </div>
        <a href="/properties/new" className="btn btn-primary no-underline text-sm font-semibold">
          + Add Property
        </a>
      </div>

      {invites.length > 0 && <InviteBannerList invites={invites} />}

      {isBoth && ownerStats && tenantStats && (
        <RoleToggle
          activeView={activeView}
          setActiveView={setActiveView}
          ownerStats={ownerStats}
          tenantStats={tenantStats}
        />
      )}

      {(!isBoth || activeView === 'owner') && ownerStats && (
        <OwnerDashboard stats={ownerStats} onUpdate={setOwnerStats} />
      )}
      
      {(!isBoth || activeView === 'tenant') && tenantStats && (
        <TenantDashboard stats={tenantStats} />
      )}
    </div>
  );
}

function InviteBannerList({ invites }: { invites: PendingInvite[] }) {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {invites.map(inv => (
        <div key={inv.inviteToken} className="rounded-xl border border-border bg-surface p-5 border-l-4 border-l-accent">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="m-0 text-[0.9375rem] font-semibold text-foreground font-heading">{inv.propertyName}</p>
            <Badge variant="info">Invite</Badge>
          </div>
          {inv.propertyAddress && (
            <p className="mt-1 mb-0 text-[0.8125rem] text-muted-foreground">{inv.propertyAddress}</p>
          )}
          <a
            href={`/invite/${inv.inviteToken}`}
            className="inline-flex items-center justify-center rounded-md bg-foreground text-background font-medium px-4 py-2 text-sm mt-4 hover:opacity-90 transition-opacity no-underline"
          >
            View invite
          </a>
        </div>
      ))}
    </div>
  );
}

function RoleToggle({
  activeView,
  setActiveView,
  ownerStats,
  tenantStats
}: {
  activeView: 'owner' | 'tenant';
  setActiveView: (view: 'owner' | 'tenant') => void;
  ownerStats: OwnerDashboardStats;
  tenantStats: TenantDashboardStats;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Owner Summary Card */}
        <div
          className={`rounded-xl border p-5 transition-colors cursor-pointer ${
            activeView === 'owner' ? 'border-accent ring-1 ring-accent/20 bg-surface' : 'border-border bg-surface hover:bg-surface-raised'
          }`}
          onClick={() => setActiveView('owner')}
        >
          <h3 className="text-base font-semibold mb-2 font-heading">Owner</h3>
          <ul className="space-y-1 text-sm text-muted-foreground list-none p-0 m-0 mb-4">
            <li>{ownerStats.totalProperties} properties · {ownerStats.activeTenants} tenants</li>
            <li>{formatCurrency(ownerStats.totalExportEarnings)} solar earnings</li>
            <li>{ownerStats.outstandingBills.length} unpaid bill{ownerStats.outstandingBills.length !== 1 && 's'}</li>
          </ul>
          <a href="/properties" className="text-sm font-semibold text-accent hover:text-accent/80 no-underline">View Properties →</a>
        </div>

        {/* Tenant Summary Card */}
        <div
          className={`rounded-xl border p-5 transition-colors cursor-pointer ${
            activeView === 'tenant' ? 'border-accent ring-1 ring-accent/20 bg-surface' : 'border-border bg-surface hover:bg-surface-raised'
          }`}
          onClick={() => setActiveView('tenant')}
        >
          <h3 className="text-base font-semibold mb-2 font-heading">Tenant</h3>
          <ul className="space-y-1 text-sm text-muted-foreground list-none p-0 m-0 mb-4">
            {tenantStats.activeTenancies[0] ? (
              <>
                <li>{tenantStats.activeTenancies[0].propertyName}</li>
                <li>{tenantStats.currentBill?.totalDue ? `Current bill: ${formatCurrency(tenantStats.currentBill.totalDue)}` : 'No current bill'}</li>
                {tenantStats.currentBill?.status && (
                  <li className={tenantStats.currentBill.status === 'paid' ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'}>
                    {tenantStats.currentBill.status.toUpperCase()}
                  </li>
                )}
              </>
            ) : (
              <li>No active tenancies</li>
            )}
          </ul>
          {tenantStats.activeTenancies[0] && (
            <a href={`/tenancies/${tenantStats.activeTenancies[0].tenancyId}`} className="text-sm font-semibold text-accent hover:text-accent/80 no-underline">View Tenancy →</a>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex items-center p-1 bg-surface border border-border rounded-full">
          <button
            onClick={() => setActiveView('owner')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              activeView === 'owner' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Owner View
          </button>
          <button
            onClick={() => setActiveView('tenant')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              activeView === 'tenant' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tenant View
          </button>
        </div>
      </div>
    </div>
  );
}
