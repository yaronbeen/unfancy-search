"use client";

import { useEffect, useRef, useCallback, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

/**
 * Hook to manage a Cloudflare Turnstile widget.
 *
 * Returns a container ref (attach to a <div>), the current token, and a reset function.
 * The widget uses "interaction-only" appearance — invisible unless a challenge is needed.
 * Tokens auto-refresh before expiry via refresh-expired: "auto".
 */
export function useTurnstile(siteKey: string | undefined) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const tryRender = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (t: string) => setToken(t),
          "expired-callback": () => setToken(null),
          "error-callback": () => setToken(null),
          "refresh-expired": "auto",
          appearance: "interaction-only",
          size: "compact",
        });
        return true;
      }
      return false;
    };

    // Try immediately, then poll until the script loads
    if (!tryRender()) {
      const interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 500);
      const timeout = setTimeout(() => clearInterval(interval), 15000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  const resetToken = useCallback(() => {
    setToken(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  return { containerRef, token, resetToken };
}
