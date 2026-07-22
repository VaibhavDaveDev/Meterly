import { useState, useEffect } from 'react';
import { Plus, Building2, SunMedium, Users, FileText, Clock, CheckCircle, ChevronDown, ChevronUp, ArchiveRestore } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { Badge } from '../ui/badge';
import { formatCurrency } from '../../lib/format';
import { useToast } from '../../hooks/use-toast';

type Property = {
  id: string;
  name: string;
  address?: string;
  hasSolar: boolean;
  soloMode: boolean;
  tenantCount?: number;
  currentPeriodStatus: 'draft' | 'submitted' | 'confirmed' | 'pending_approval' | null;
  currentPeriodMonth: string | null;
  lastBillTotal: number | null;
  lastBillMonth: string | null;
  lastBillPaidCount: number | null;
  lastBillTenantCount: number | null;
  archivedAt: string | null;
};

type PropertiesResponse = {
  owned: Property[];
  tenant: Property[];
  tenantPast: Property[];
};

export function PropertyList() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [archivedProperties, setArchivedProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProperties = properties.filter(prop => {
    const query = searchQuery.toLowerCase();
    return prop.name.toLowerCase().includes(query) || (prop.address && prop.address.toLowerCase().includes(query));
  });

  const filteredArchived = archivedProperties.filter(prop => {
    const query = searchQuery.toLowerCase();
    return prop.name.toLowerCase().includes(query) || (prop.address && prop.address.toLowerCase().includes(query));
  });

  useEffect(() => {
    async function fetchProperties() {
      const res = await apiClient.get<PropertiesResponse>('/properties?include_archived=true');
      if (res.error) {
        setError(res.error.message);
      } else if (res.data) {
        // Properties page is only for owners, so we only display owned properties.
        const allOwned = res.data.owned;
        setProperties(allOwned.filter(p => !p.archivedAt));
        setArchivedProperties(allOwned.filter(p => !!p.archivedAt));
      }
      setLoading(false);
    }
    fetchProperties();
  }, []);

  const handleUnarchive = async (propertyId: string) => {
    setLoading(true);
    const res = await apiClient.patch<{ success: boolean; data: Property }>(`/properties/${propertyId}/unarchive`, {});
    if (res.error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to unarchive property: ${res.error.message}`,
      });
      setLoading(false);
    } else if (res.data) {
      const propToMove = archivedProperties.find(p => p.id === propertyId);
      if (propToMove) {
        setArchivedProperties(prev => prev.filter(p => p.id !== propertyId));
        setProperties(prev => [...prev, { ...propToMove, archivedAt: null }]);
      }
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-border bg-surface p-6 min-h-[140px] flex flex-col justify-center">
            <div className="skeleton h-5 w-48 mb-2 rounded" />
            <div className="skeleton h-4 w-72 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-red-500">
        <p>Failed to load properties: {error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-secondary mt-4">Retry</button>
      </div>
    );
  }



  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold font-heading m-0 tracking-tight">My Properties</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search properties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 text-sm rounded-lg border border-border bg-surface focus:border-accent focus:outline-none w-full md:w-64"
          />
          <a href="/properties/new" className="btn btn-primary no-underline text-sm font-semibold whitespace-nowrap">
            + Add Property
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-surface border border-border rounded-xl text-center w-full max-w-2xl mx-auto my-4">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-6 text-accent">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-heading font-semibold mb-2">You haven't added a property yet.</h3>
            <p className="text-muted-foreground mb-8 max-w-sm font-body">
              Meterly tracks electricity bills between you and your tenants. Add a property to get started.
            </p>
            <a 
              href="/properties/new"
              className="btn btn-primary no-underline inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Your First Property
            </a>
          </div>
        ) : (
          <>
            {filteredProperties.length === 0 ? (
              <div className="text-center py-12 border border-border border-dashed rounded-xl bg-muted/20">
                <p className="text-muted-foreground m-0">No properties match your search.</p>
              </div>
            ) : (
              filteredProperties.map((prop) => {
              const statusBadge = (() => {
            if (prop.currentPeriodStatus === 'draft') {
              return <Badge variant="warning">Draft</Badge>;
            } else if (prop.currentPeriodStatus === 'submitted') {
              return <Badge variant="info">Submitted</Badge>;
            } else if (prop.currentPeriodStatus === 'pending_approval') {
              return <Badge variant="warning">Needs Approval</Badge>;
            } else if (prop.currentPeriodStatus === 'confirmed') {
              return <Badge variant="success">Confirmed</Badge>;
            } else {
              return <Badge variant="muted">No readings yet</Badge>;
            }
          })();

          let paymentIndicator = null;
          if (prop.lastBillMonth && prop.lastBillTenantCount !== null && prop.lastBillPaidCount !== null) {
            const allPaid = prop.lastBillPaidCount === prop.lastBillTenantCount && prop.lastBillTenantCount > 0;
            const nonePaid = prop.lastBillPaidCount === 0 && prop.lastBillTenantCount > 0;
            const colorClass = allPaid ? 'text-emerald-500' : (nonePaid ? 'text-red-500' : 'text-amber-500');
            const icon = allPaid ? <CheckCircle className="w-3.5 h-3.5" /> : (nonePaid ? <Clock className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />);
            paymentIndicator = (
              <span className={`inline-flex items-center gap-1.5 font-medium ${colorClass}`}>
                {icon}
                {prop.lastBillPaidCount} of {prop.lastBillTenantCount} paid
              </span>
            );
          }

          return (
            <div 
              key={prop.id} 
              className="group block rounded-xl border border-border bg-surface hover:bg-surface-raised transition-colors p-6"
            >
              {/* Row Header - Badges */}
              <div className="flex items-center gap-2 mb-3">
                {prop.hasSolar && (
                  <Badge variant="warning" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                    <SunMedium className="w-3 h-3 mr-1" />
                    Solar
                  </Badge>
                )}
                {prop.soloMode && (
                  <Badge variant="muted">Solo Mode</Badge>
                )}
              </div>

              {/* Title & Address */}
              <div className="mb-4">
                <h2 className="text-lg font-semibold font-heading text-foreground mb-1">
                  {prop.name}
                </h2>
                {prop.address && (
                  <p className="text-sm text-muted-foreground m-0 font-body">
                    {prop.address}
                  </p>
                )}
              </div>

              {/* Status Row */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                {!prop.soloMode && (
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>{prop.tenantCount || 0} active tenant{prop.tenantCount !== 1 ? 's' : ''}</span>
                  </div>
                )}
                
                {/* Separator if needed */}
                {!prop.soloMode && <span className="text-border">•</span>}

                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>{prop.currentPeriodMonth ? `${prop.currentPeriodMonth}:` : 'Current:'}</span>
                  {statusBadge}
                </div>
              </div>

              {/* Bottom Row - Bill Summary & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between pt-4 border-t border-border gap-4">
                <div>
                  {prop.lastBillMonth ? (
                    <p className="text-sm text-muted-foreground m-0">
                      Last bill: <span className="font-medium text-foreground">{prop.lastBillMonth}</span>
                      <span className="mx-2">•</span>
                      <span className="font-numbers font-medium text-foreground">{formatCurrency(prop.lastBillTotal || 0)}</span>
                      {!prop.soloMode && (
                        <>
                          <span className="mx-2">•</span>
                          {paymentIndicator}
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground m-0 italic">
                      No past bills available.
                    </p>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <a href={`/properties/${prop.id}`} className="btn btn-primary py-1.5 px-3 text-xs no-underline font-medium">
                    View Dashboard
                  </a>
                </div>
              </div>
            </div>
          );
        }))}

        <a 
          href="/properties/new"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface p-6 text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent hover:bg-surface-raised min-h-[140px] mt-4"
        >
          <div className="rounded-full bg-background p-2 shadow-sm border border-border group-hover:border-accent/30">
            <Plus className="w-5 h-5" />
          </div>
          <span className="font-semibold text-sm">Add New Property</span>
        </a>
          </>
        )}
      </div>

      {archivedProperties.length > 0 && (
        <div className="mt-12">
          <button 
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium text-sm mb-4"
          >
            {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Archived Properties ({archivedProperties.length})
          </button>
          
          {showArchived && (
            <div className="flex flex-col gap-3 pl-6 border-l-2 border-border/50">
              {filteredArchived.length === 0 ? (
                <p className="text-xs text-muted-foreground m-0 italic">No archived properties match your search.</p>
              ) : (
                filteredArchived.map((prop) => (
                <div key={prop.id} className="flex items-center justify-between p-4 rounded-lg bg-surface border border-border">
                  <div>
                    <h3 className="font-semibold text-foreground font-heading">{prop.name}</h3>
                    {prop.lastBillMonth ? (
                      <p className="text-xs text-muted-foreground m-0 mt-1">Last bill: {prop.lastBillMonth}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground m-0 mt-1">No past bills</p>
                    )}
                  </div>
                  <button 
                    onClick={() => handleUnarchive(prop.id)}
                    className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    disabled={loading}
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" /> Unarchive
                  </button>
                </div>
              )))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
