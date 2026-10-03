'use client';

import { useCallback, useEffect, useRef } from 'react';
import Script from 'next/script';

// The bare Cloudflare Turnstile widget: renders the challenge and hands its token to the caller,
// nothing else. Two callers spend the token differently:
//  - TurnstileChallenge (the Calendly gate) sends it to /api/turnstile/verify;
//  - the admin's password-reset request sends it in the `x-captcha-response` header, where Better
//    Auth's captcha plugin verifies it (ADR-022).
// A token is single-use and lives 300 s, so a caller that needs another one remounts this component
// (give it a new `key`): unmounting removes the widget, mounting renders a fresh challenge.

const TURNSTILE_WIDGET_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
};

type TurnstileGlobal = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

export interface TurnstileWidgetProps {
  siteKey: string;
  /** A fresh token. Single-use: spend it once, then remount the widget for another. */
  onToken: (token: string) => void;
  /** The token expired unspent; the widget re-solves on its own. */
  onExpire?: () => void;
  /** The challenge could not run (network, blocked script, failed check). */
  onError?: () => void;
  className?: string;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  onExpire,
  onError,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // The latest callbacks, read when Turnstile calls back — so a parent's inline handlers never
  // force the widget to be torn down and solved again.
  const callbacks = useRef({ onToken, onExpire, onError });
  useEffect(() => {
    callbacks.current = { onToken, onExpire, onError };
  });

  const renderWidget = useCallback(() => {
    const container = containerRef.current;
    if (!container || widgetId.current !== null || !window.turnstile) return;
    widgetId.current = window.turnstile.render(container, {
      sitekey: siteKey,
      callback: (token) => callbacks.current.onToken(token),
      'expired-callback': () => callbacks.current.onExpire?.(),
      'error-callback': () => callbacks.current.onError?.(),
    });
  }, [siteKey]);

  useEffect(() => {
    // The script may already be loaded (a remount); `onReady` below covers the first load.
    renderWidget();
    return () => {
      if (widgetId.current === null) return;
      window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [renderWidget]);

  return (
    <>
      <div ref={containerRef} className={className} />
      <Script src={TURNSTILE_WIDGET_SRC} strategy="afterInteractive" onReady={renderWidget} />
    </>
  );
}
