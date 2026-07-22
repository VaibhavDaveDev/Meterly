// A simple, type-safe fetch wrapper for our API
// This can be expanded with error handling, token refresh logic, etc.

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

import { startProgress, stopProgress } from './progress-state';

async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<{ data: T | null; error: { message: string } | null }> {
  startProgress();
  try {
    const response = await fetch(`/api${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json() as ApiResponse<never>;
      return {
        data: null,
        error: { message: errorData.error?.message || `API Error: ${response.status}` },
      };
    }

    const responseData = await response.json() as ApiResponse<T>;
    if (responseData.success) {
      return { data: responseData.data, error: null };
    } else {
      return { data: null, error: { message: responseData.error?.message || 'An unknown error occurred' } };
    }

  } catch (err) {
    return { data: null, error: { message: (err as Error).message || 'Network request failed' } };
  } finally {
    stopProgress();
  }
}

export const apiClient = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint),
  post: <T>(endpoint: string, body: Record<string, unknown>) => apiFetch<T>(endpoint, { method: 'POST', body }),
  patch: <T>(endpoint: string, body: Record<string, unknown>) => apiFetch<T>(endpoint, { method: 'PATCH', body }),
  delete: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),
};

export const archiveTenancy = (tenancyId: string) =>
  fetch(`/api/tenancies/${tenancyId}/archive`, { method: 'PATCH', credentials: 'include' });

export const unarchiveTenancy = (tenancyId: string) =>
  fetch(`/api/tenancies/${tenancyId}/unarchive`, { method: 'PATCH', credentials: 'include' });
