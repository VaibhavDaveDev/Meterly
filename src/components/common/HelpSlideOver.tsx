import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export function HelpSlideOver({ isOwner }: { isOwner: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'owner' | 'tenant'>(isOwner ? 'owner' : 'tenant');

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-transform hover:scale-105 z-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Help"
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* SlideOver */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-surface border-l border-border shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-heading font-semibold">Help & FAQ</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full p-2 hover:bg-surface-raised transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close Help"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-border px-6 pt-4 gap-6">
          <button
            onClick={() => setTab('owner')}
            className={`pb-3 text-sm font-medium transition-colors focus-visible:outline-none ${tab === 'owner' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Owner Guide
          </button>
          <button
            onClick={() => setTab('tenant')}
            className={`pb-3 text-sm font-medium transition-colors focus-visible:outline-none ${tab === 'tenant' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Tenant Guide
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'owner' ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Getting started</h3>
                <ul className="space-y-4">
                  <li>
                    <h4 className="font-medium text-base mb-1">1. Add a property & set your rates</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Create a property and configure your electricity rates (consumption, fixed charges, and solar export if applicable).</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">2. Invite your tenants</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Send an email invite to your tenants. They'll join the property and can be assigned a percentage of the total bill.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">3. Add meter readings at end of each month</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">When your grid bill arrives, enter the main meter reading and tenant sub-meter readings. Meterly calculates everyone's share automatically.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">4. Tenants get notified & can view their bill</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Meterly emails your tenants a detailed breakdown of their bill, so there's full transparency on how it was calculated.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">5. Mark as paid when you receive the money</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Keep track of who has paid and who still owes you money directly from your dashboard.</p>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Common tasks</h3>
                <ul className="space-y-4">
                  <li>
                    <h4 className="font-medium text-base mb-1">Adding a new billing period</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Go to your property → Billing Periods → "Add Period". Each period covers one calendar month.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">Changing electricity rates</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Property → Rates → "Add Rate". Rates are effective from the date you set. Past bills are not recalculated.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">Inviting or removing a tenant</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Property → Tenants → "Invite Tenant". To remove, end the tenancy. Past bills remain visible to the tenant.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">Editing a meter reading (owner override)</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Go to the reading in the Billing Period → click Edit. All downstream bills recalculate automatically.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">Marking a bill as paid</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Bills page → find the tenant's bill → "Mark as Paid".</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">Handling a wrong reading</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Owners can edit any reading directly. Tenants must submit an edit request which you then approve or reject.</p>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Understanding the numbers</h3>
                <ul className="space-y-4">
                  <li>
                    <h4 className="font-medium text-base mb-1">How the split percentage works</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Each tenant is assigned a percentage of the total bill. Percentages across all tenants must add up to 100%.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">Solar generation, export, and import</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Import = electricity bought from the grid. Export = surplus solar electricity sold back to the grid. Generation = total solar produced (used + exported).</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">Why a bill looks different from last month</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Rates may have changed, consumption may differ, or a custom charge (e.g. maintenance fee) may have been added.</p>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Your bill</h3>
                <ul className="space-y-4">
                  <li>
                    <h4 className="font-medium text-base mb-1">Where to find your bill</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Dashboard → Bills. Each month appears as a separate entry.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">What's in your bill amount</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Your share of electricity consumption plus any custom charges your owner has added (e.g. fixed fees).</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">How to read the breakdown</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Each bill shows: consumption (kWh), rate (per kWh), your split percentage, and the final amount due.</p>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Submitting readings</h3>
                <ul className="space-y-4">
                  <li>
                    <h4 className="font-medium text-base mb-1">When and how to submit a meter reading</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Your owner opens a billing period for the month. You'll see a prompt in your dashboard. Enter your sub-meter end readings.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">What happens after you submit</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">If your owner has auto-approval on, your bill is generated immediately. Otherwise it waits for owner approval.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">I made a mistake — how to correct it</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Go to the reading → "Request Edit". Your owner will review and approve or reject the correction.</p>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Invite & account</h3>
                <ul className="space-y-4">
                  <li>
                    <h4 className="font-medium text-base mb-1">I got an invite — what do I do?</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Click the link in the email. If you don't have an account, you'll create one during acceptance. The invite expires in 7 days.</p>
                  </li>
                  <li>
                    <h4 className="font-medium text-base mb-1">How to update your account / profile</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed m-0">Top-right menu → Settings. You can update your name and password.</p>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border bg-surface-raised/50">
          <a href="mailto:meterly.support@protonmail.com" className="text-sm font-medium text-primary hover:underline">
            Still need help? Contact support
          </a>
        </div>
      </div>
    </>
  );
}
