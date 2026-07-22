import { useEffect, useRef } from 'react';

export function useTurnstile(turnstileSiteKey?: string) {
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!turnstileSiteKey) {
      console.log('[Turnstile] Site key not provided - running in dev/test mode');
      return;
    }
    
    const renderTurnstile = () => {
      if (window.turnstile && turnstileRef.current && turnstileSiteKey) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          theme: 'dark',
        });
      }
    };
    
    if (window.turnstile) {
      renderTurnstile();
    } else {
      window.onloadTurnstileCallback = renderTurnstile;
    }
  }, [turnstileSiteKey]);

  return turnstileRef;
}

declare global {
  interface Window {
    turnstile?: {
      render: (element: string | HTMLElement, options: Record<string, unknown>) => void;
      reset: () => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}
