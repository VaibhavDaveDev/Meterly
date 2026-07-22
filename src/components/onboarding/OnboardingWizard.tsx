import { useState, useEffect, type SubmitEvent } from 'react';
import { Home, User, Sun, Zap, Check } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

type Role = 'owner' | 'tenant' | 'both' | null;

export function OnboardingWizard() {
  const [step, setStep] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('onboarding_step');
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });

  useEffect(() => {
    localStorage.setItem('onboarding_step', step.toString());
  }, [step]);

  const [hasSolar, setHasSolar] = useState<boolean>(false);
  const [propertyName, setPropertyName] = useState('');
  const [soloMode, setSoloMode] = useState(false);
  const [readingReminderDay, setReadingReminderDay] = useState<number>(5);
  
  const [propertyId, setPropertyId] = useState<string | null>(null);
  
  const [ratesForm, setRatesForm] = useState({
    consumptionRate: '',
    exportRate: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantProperty, setTenantProperty] = useState<{ name: string, splitPercentage: number | null, tenantCount: number } | null>(null);

  const handleRoleSelection = async (selectedRole: Role) => {

    setError(null);
    // Save preference
    const res = await apiClient.patch('/users/onboarding', { primaryRole: selectedRole });
    if (res.error) {
      setError(res.error.message);
      return;
    }

    if (selectedRole === 'tenant') {
      const propRes = await apiClient.get<{ tenant: Array<{ name: string, splitPercentage: number | null, tenantCount: number }> }>('/properties');
      const tenantData = propRes.data?.tenant;
      if (!propRes.error && tenantData && tenantData.length > 0) {
        setTenantProperty(tenantData[0]);
        setStep(5);
      } else {
        await completeOnboarding();
      }
    } else {
      setStep(2);
    }
  };

  const completeOnboarding = async () => {
    setError(null);
    const res = await apiClient.patch('/users/onboarding', { markCompleted: true });
    if (res.error) {
      setError(res.error.message);
      return;
    }
    window.location.href = '/dashboard';
  };

  const handleCreateProperty = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!propertyName.trim()) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ id: string }>('/properties', {
        name: propertyName,
        hasSolar: hasSolar,
        soloMode: soloMode,
      });

      if (res.error) {
        setError(res.error.message);
      } else if (res.data) {
        setPropertyId(res.data.id);
        
        // If they provided a reading reminder day != 5, update settings
        if (readingReminderDay !== 5) {
          await apiClient.patch(`/properties/${res.data.id}/settings`, { readingReminderDay });
        }
        
        setStep(3);
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveRates = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!propertyId) return;
    
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post(`/properties/${propertyId}/rates`, {
        consumptionRate: parseFloat(ratesForm.consumptionRate),
        exportRate: hasSolar ? parseFloat(ratesForm.exportRate) || 0 : 0,
        effectiveFrom: new Date().toISOString().split('T')[0],
      });

      if (res.error) {
        setError(res.error.message);
      } else {
        await completeOnboarding();
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-12">
      <div className="mb-8 px-4 sm:px-0">
        <div className="flex items-center justify-between gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${step >= i ? 'bg-primary' : 'bg-transparent'}`} 
              />
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Welcome to Meterly.</h1>
            <p className="text-muted-foreground text-lg">What describes you best?</p>
          </div>

          <div className="grid gap-4 mt-8">
            <button
              onClick={() => handleRoleSelection('owner')}
              className="flex items-start p-6 text-left border rounded-xl hover:border-accent hover:bg-accent/5 transition-all"
            >
              <div className="p-3 bg-primary/10 rounded-lg text-primary mr-4">
                <Home className="w-6 h-6" />
              </div>
              <div>
                <div className="font-semibold text-lg">I own a property</div>
                <div className="text-muted-foreground">I want to track electricity bills for my tenants or myself.</div>
              </div>
            </button>

            <button
              onClick={() => handleRoleSelection('tenant')}
              className="flex items-start p-6 text-left border rounded-xl hover:border-accent hover:bg-accent/5 transition-all"
            >
              <div className="p-3 bg-primary/10 rounded-lg text-primary mr-4">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="font-semibold text-lg">I am a tenant</div>
                <div className="text-muted-foreground">My landlord sent me an invite link.</div>
              </div>
            </button>

            <div className="pt-2 text-center">
              <button
                onClick={() => handleRoleSelection('both')}
                className="text-sm text-muted-foreground hover:text-foreground underline decoration-muted-foreground/30 underline-offset-4"
              >
                Both — I own one place and also rent another
              </button>
            </div>
          </div>
          {error && <div className="text-red-500 text-sm mt-4 text-center">{error}</div>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Let's set up your first property.</h2>
            <p className="text-muted-foreground">You can always add more properties later.</p>
          </div>

          <div className="bg-card border rounded-xl shadow-sm max-w-md mx-auto p-6">
            <form onSubmit={handleCreateProperty} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="name">
                  Property name
                </label>
                <input
                  id="name"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder='e.g. "Home" or "Flat 2B"'
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-3 pt-2 border-t">
                <label className="text-sm font-medium leading-none">
                  Does the property have solar panels?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${hasSolar ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'hover:bg-muted'}`}>
                    <input type="radio" name="solar" checked={hasSolar} onChange={() => setHasSolar(true)} className="hidden" />
                    <Sun className="w-4 h-4" /> <span className="text-sm font-medium">Yes, Solar</span>
                  </label>
                  <label className={`flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${!hasSolar ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                    <input type="radio" name="solar" checked={!hasSolar} onChange={() => setHasSolar(false)} className="hidden" />
                    <Zap className="w-4 h-4" /> <span className="text-sm font-medium">No, Grid only</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <label className="text-sm font-medium leading-none">
                  Who will use this property?
                </label>
                <div className="grid gap-3">
                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${!soloMode ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                    <input 
                      type="radio" 
                      name="soloMode" 
                      checked={!soloMode} 
                      onChange={() => setSoloMode(false)}
                      className="accent-primary"
                    />
                    <div className="text-sm">I have tenants (track and split bills)</div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${soloMode ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                    <input 
                      type="radio" 
                      name="soloMode" 
                      checked={soloMode} 
                      onChange={() => setSoloMode(true)}
                      className="accent-primary"
                    />
                    <div className="text-sm">Just me (track my own bills)</div>
                  </label>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <label className="text-sm font-medium leading-none">
                  Reading Reminder (optional)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Send reminder on the</span>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    className="flex h-9 w-16 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={readingReminderDay}
                    onChange={(e) => setReadingReminderDay(parseInt(e.target.value) || 1)}
                  />
                  <span className="text-sm text-muted-foreground">th if readings aren't submitted</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!propertyName.trim() || isSubmitting}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Property'}
              </button>
              
              <div className="text-center text-xs text-muted-foreground">
                You'll set up your electricity rates next.
              </div>
              {error && <div className="text-red-500 text-sm text-center">{error}</div>}
            </form>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Set your electricity rates</h2>
            <p className="text-muted-foreground">These rates are used to calculate your tenant's bill.</p>
          </div>

          <div className="bg-card border rounded-xl shadow-sm max-w-md mx-auto p-6">
            <form onSubmit={handleSaveRates} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="consumptionRate">
                  Consumption Rate (per unit) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                  <input
                    id="consumptionRate"
                    type="number"
                    step="0.01"
                    min="0"
                    className="flex h-10 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="e.g. 7.50"
                    value={ratesForm.consumptionRate}
                    onChange={(e) => setRatesForm({ ...ratesForm, consumptionRate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg text-xs text-muted-foreground mt-4">
                <p><strong>Note:</strong> Rates are set per unit consumed. For fixed charges from your electricity board (meter rent, fixed service charges), add them separately in the Custom Charges section for each billing period.</p>
              </div>

              {hasSolar && (
                <div className="space-y-2 pt-2 border-t">
                  <label className="text-sm font-medium leading-none" htmlFor="exportRate">
                    Solar Export Rate (per unit)
                  </label>
                  <p className="text-xs text-muted-foreground">What the grid pays you for exported solar.</p>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                    <input
                      id="exportRate"
                      type="number"
                      step="0.01"
                      min="0"
                      className="flex h-10 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="e.g. 2.25"
                      value={ratesForm.exportRate}
                      onChange={(e) => setRatesForm({ ...ratesForm, exportRate: e.target.value })}
                      required={hasSolar}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!ratesForm.consumptionRate || isSubmitting}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Finish Setup'}
              </button>
              
              {error && <div className="text-red-500 text-sm text-center">{error}</div>}
            </form>
          </div>
        </div>
      )}

      {step === 5 && tenantProperty && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">You're all set!</h2>
            <p className="text-muted-foreground">Welcome to {tenantProperty.name}.</p>
          </div>

          <div className="bg-card border rounded-xl shadow-sm max-w-md mx-auto p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-2">
              <Check className="w-8 h-8" />
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Your Billing Share</h3>
              <p className="text-muted-foreground">
                {tenantProperty.splitPercentage !== null 
                  ? `Your landlord has set your share at ${tenantProperty.splitPercentage}% of the property's electricity bill.`
                  : tenantProperty.tenantCount > 1
                    ? `You'll pay an equal share of the property's bill. The exact % adjusts based on how many tenants are living there.`
                    : `You're currently the only tenant. You'll pay the full bill until another tenant joins.`}
              </p>
            </div>

            <div className="pt-8">
              <button
                onClick={completeOnboarding}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8"
              >
                Go to Dashboard
              </button>
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
