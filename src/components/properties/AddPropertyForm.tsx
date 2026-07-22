import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { useToast } from '../../hooks/use-toast';
import { apiClient } from '../../lib/api-client';
import { Building2, MapPin, SunMedium, Zap, Activity, AlertCircle } from 'lucide-react';

export function AddPropertyForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    hasSolar: false,
  });
  const [solarGenInitial, setSolarGenInitial] = useState('');
  const [solarExportInitial, setSolarExportInitial] = useState('');
  const [nameWarning, setNameWarning] = useState('');

  useEffect(() => {
    const propertyName = formData.name.trim();
    if (!propertyName) {
      setNameWarning('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/properties/check-name?name=${encodeURIComponent(propertyName)}`);
        const json = (await res.json()) as { exists: boolean };
        if (json.exists) {
          setNameWarning(`You already have a property named "${propertyName}". You can still create this one, but consider using a different name to avoid confusion.`);
        } else {
          setNameWarning('');
        }
      } catch (err) {
        console.error('Error checking duplicate name:', err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.name]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const payload = {
      ...formData,
      ...(formData.hasSolar && {
        solarGenInitial: parseFloat(solarGenInitial) || 0,
        solarExportInitial: parseFloat(solarExportInitial) || 0,
      }),
    };

    const { data, error } = await apiClient.post<{ id: string }>('/properties', payload);

    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error adding property",
        description: error.message,
      });
      return;
    }

    toast({
      title: "Success!",
      description: "Property added successfully.",
    });

    if (data?.id) {
      // Redirect to the new property's settings to set up rates
      window.location.href = `/properties/${data.id}`;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Building2 className="w-8 h-8 text-primary" />
          Add New Property
        </h1>
        <p className="text-muted-foreground mt-2">
          Create a new property to start tracking electricity bills.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              Property Name <span className="text-red-500">*</span>
            </Label>
            <Input 
              id="name" 
              placeholder="e.g. 14 Raj Nagar, Flat 2B" 
              required 
              maxLength={100}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
            {nameWarning && (
              <div className="text-sm text-amber-600 dark:text-amber-500 flex items-start gap-2 mt-1.5 font-medium">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{nameWarning}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">A recognizable name for your dashboard.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" /> Address (Optional)
            </Label>
            <Input 
              id="address" 
              placeholder="Full address details"
              maxLength={200}
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <SunMedium className="w-5 h-5 text-amber-500" />
                Solar Installation
              </Label>
              <p className="text-sm text-muted-foreground">
                Does this property have solar panels that export to the grid?
              </p>
            </div>
            <Switch 
              checked={formData.hasSolar}
              onCheckedChange={checked => setFormData({ ...formData, hasSolar: checked })}
            />
          </div>

          {formData.hasSolar && (
            <div className="pt-4 border-t mt-4 space-y-4 animate-in fade-in slide-in-from-top-4">
              <div className="rounded-md bg-amber-500/10 p-4 border border-amber-500/20">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Because this is a solar property, we need the <strong>current</strong> readings from your solar meters. These will act as the starting point (zero baseline) for your first bill.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="solarGenInitial" className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> Initial Solar Generation (Units)
                  </Label>
                  <Input 
                    id="solarGenInitial" 
                    type="number"
                    min="0"
                    max={9999999}
                    step="0.01"
                    required={formData.hasSolar}
                    value={solarGenInitial}
                    onChange={e => setSolarGenInitial(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="solarExportInitial" className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" /> Initial Export to Grid (Units)
                  </Label>
                  <Input 
                    id="solarExportInitial" 
                    type="number"
                    min="0"
                    max={9999999}
                    step="0.01"
                    required={formData.hasSolar}
                    value={solarExportInitial}
                    onChange={e => setSolarExportInitial(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-4">
          <Button variant="outline" type="button" onClick={() => window.history.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || !formData.name}>
            {isLoading ? 'Saving...' : 'Add Property'}
          </Button>
        </div>
      </form>
    </div>
  );
}
