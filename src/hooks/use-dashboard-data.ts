import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api-client';
import type { PendingInvite, UserProfile, OwnerDashboardStats, TenantDashboardStats } from '../components/dashboard/types';
import { getCachedDashboard, setCachedDashboard } from '../lib/dashboard-cache';

export function useDashboardData() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [ownerStats, setOwnerStats] = useState<OwnerDashboardStats | null>(null);
  const [tenantStats, setTenantStats] = useState<TenantDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'owner' | 'tenant'>('owner');

  useEffect(() => {
    Promise.all([
      apiClient.get<PendingInvite[]>('/invites/pending'),
      apiClient.get<UserProfile>('/users/me'),
    ]).then(async ([invRes, usrRes]) => {
      if (invRes.data) setInvites(invRes.data);
      if (usrRes.data) {
        setUser(usrRes.data);
        const role = usrRes.data.primaryRole;
        
        // Sidebar persistence - restore saved view if 'both'
        let initialView = role;
        if (role === 'both') {
          const saved = localStorage.getItem('meterly-active-view');
          initialView = (saved === 'owner' || saved === 'tenant') ? saved : 'owner';
        }
        setActiveView(initialView as 'owner' | 'tenant');

        const fetchPromises = [];
        if (role === 'owner' || role === 'both') {
          fetchPromises.push((async () => {
            const cachedOwner = await getCachedDashboard<OwnerDashboardStats>('owner');
            if (cachedOwner) setOwnerStats(cachedOwner);
            
            const res = await apiClient.get<OwnerDashboardStats>('/dashboard/owner');
            if (res.data) {
              setOwnerStats(res.data);
              await setCachedDashboard('owner', res.data);
            }
          })());
        }
        if (role === 'tenant' || role === 'both') {
          fetchPromises.push((async () => {
            const cachedTenant = await getCachedDashboard<TenantDashboardStats>('tenant');
            if (cachedTenant) setTenantStats(cachedTenant);

            const res = await apiClient.get<TenantDashboardStats>('/dashboard/tenant');
            if (res.data) {
              setTenantStats(res.data);
              await setCachedDashboard('tenant', res.data);
            }
          })());
        }
        await Promise.all(fetchPromises);
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    });
  }, []);

  return {
    user,
    invites,
    ownerStats,
    tenantStats,
    loading,
    error,
    activeView,
    setActiveView: (view: 'owner' | 'tenant') => {
      setActiveView(view);
      localStorage.setItem('meterly-active-view', view);
    },
    setOwnerStats
  };
}
