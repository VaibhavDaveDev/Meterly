import { useEffect, useRef, useCallback } from "react";

export function useTurnstile(turnstileSiteKey?: string) {
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey) {
      console.log(
        "[Turnstile] Site key not provided - running in dev/test mode"
      );
      return;
    }

    const renderTurnstile = () => {
      if (window.turnstile && turnstileRef.current && turnstileSiteKey) {
        // Capture the widget ID returned by render()
        widgetIdRef.current =
          window.turnstile.render(turnstileRef.current, {
            sitekey: turnstileSiteKey,
            theme: "dark",
          }) ?? null;
      }
    };

    if (window.turnstile) {
      renderTurnstile();
    } else {
      window.onloadTurnstileCallback = renderTurnstile;
    }

    return () => {
      // Clean up widget on unmount so remounts don't double-render
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [turnstileSiteKey]);

  const reset = useCallback(() => {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  return { ref: turnstileRef, reset };
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: string | HTMLElement,
        options: Record<string, unknown>
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}
