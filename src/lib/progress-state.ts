import { useState, useEffect } from 'react';

let activeFetches = 0;
const listeners = new Set<(active: boolean) => void>();

export function startProgress() {
  activeFetches++;
  notify();
}

export function stopProgress() {
  activeFetches = Math.max(0, activeFetches - 1);
  notify();
}

function notify() {
  const isFetching = activeFetches > 0;
  listeners.forEach(l => l(isFetching));
}

export function useProgressState() {
  const [loading, setLoading] = useState(activeFetches > 0);
  useEffect(() => {
    const l = (active: boolean) => setLoading(active);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return loading;
}
