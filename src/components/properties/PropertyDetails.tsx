import type { Property } from '../../types/db';
import { PropertyChargesTable } from './PropertyChargesTable';
import { PropertySettings } from './PropertySettings';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { LayoutDashboard, Users, History, CreditCard, Settings, UserPlus } from 'lucide-react';
import { PropertyDetailsTabOverview } from './PropertyDetailsTabOverview';
import { PropertyDetailsTabTenants } from './PropertyDetailsTabTenants';
import { PropertyDetailsTabBills } from './PropertyDetailsTabBills';
import { usePropertyDetails } from '../../hooks/use-property-details';

interface PropertyDetailsProps {
  property: Property;
  tenantCount: number;
  isOwner: boolean;
  isTenant: boolean;
}

export function PropertyDetails({ property, tenantCount: initialTenantCount, isOwner }: PropertyDetailsProps) {
  const state = usePropertyDetails({ property, initialTenantCount, isOwner });
  const {
    activeTab,
    setActiveTab,
    isInviteOpen,
    setIsInviteOpen,
    inviteEmail,
    setInviteEmail,
    inviteSplit,
    setInviteSplit,
    isInviting,
    localProperty,
    setLocalProperty,
    tenancies,
    isLoadingTenants,
    isLoadingBills,
    filterYear,
    setFilterYear,
    filterStatus,
    setFilterStatus,
    availableYears,
    handleInvite,
    downloadCsv,
    billsData,
  } = state;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">{property.name}</h1>
            <Badge variant={isOwner ? 'owner' : 'tenant'}>{isOwner ? 'Owner' : 'Tenant'}</Badge>
          </div>
          <p className="text-muted-foreground text-sm m-0">{property.address || 'No address provided'}</p>
        </div>
        {isOwner && (
          <div className="flex items-center space-x-2">
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Invite Tenant
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleInvite}>
                  <DialogHeader>
                    <DialogTitle>Invite a Tenant</DialogTitle>
                    <DialogDescription>
                      Send an email invitation. They will be prompted to create an account or log in to access this property&apos;s bills.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="email" className="text-right">Email <span className="text-red-500">*</span></Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="split" className="text-right">Split %</Label>
                      <Input
                        id="split"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="Auto (Equal Split)"
                        value={inviteSplit}
                        onChange={(e) => setInviteSplit(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isInviting || !inviteEmail}>
                      {isInviting ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Tab nav — pill style */}
      <div className="overflow-x-auto">
        <nav className="flex items-center gap-1 pb-1" aria-label="Property tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`tab-pill${activeTab === 'overview' ? ' active' : ''}`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Overview
          </button>
          {isOwner && (
            <button
              onClick={() => setActiveTab('tenants')}
              className={`tab-pill${activeTab === 'tenants' ? ' active' : ''}`}
            >
              <Users className="w-3.5 h-3.5" /> Tenants
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setActiveTab('bills')}
              className={`tab-pill${activeTab === 'bills' ? ' active' : ''}`}
            >
              <History className="w-3.5 h-3.5" /> Bills
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setActiveTab('charges')}
              className={`tab-pill${activeTab === 'charges' ? ' active' : ''}`}
            >
              <CreditCard className="w-3.5 h-3.5" /> Charges
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`tab-pill${activeTab === 'settings' ? ' active' : ''}`}
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'overview' && (
          <PropertyDetailsTabOverview state={state} />
        )}
        
        {activeTab === 'tenants' && (
          <PropertyDetailsTabTenants
            propertyId={property.id}
            isLoadingTenants={isLoadingTenants}
            tenancies={tenancies}
            isOwner={isOwner}
            onInviteClick={() => setIsInviteOpen(true)}
          />
        )}

        {activeTab === 'bills' && (
          <PropertyDetailsTabBills
            property={property}
            billsData={billsData}
            isLoadingBills={isLoadingBills}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            availableYears={availableYears}
            downloadCsv={downloadCsv}
            isOwner={isOwner}
          />
        )}

        {activeTab === 'charges' && (
          <PropertyChargesTable propertyId={localProperty.id} isOwner={isOwner} />
        )}

        {activeTab === 'settings' && (
          <PropertySettings
            property={localProperty}
            isOwner={isOwner}
            onPropertyUpdate={(updated) => setLocalProperty(updated)}
          />
        )}
      </div>
    </div>
  );
}
