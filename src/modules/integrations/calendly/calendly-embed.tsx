'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';
import { CalendarX2, Loader2 } from 'lucide-react';
import { publicEnv } from '@/modules/shared/lib/env';
import { cn } from '@/modules/shared/lib/utils';

const CALENDLY_WIDGET_SRC = 'https://assets.calendly.com/assets/external/widget.js';

// The site has one fixed look (no theme switching) — these colours are passed to Calendly as hex
// without the leading '#', mirroring the app's light-content accent tokens.
const WIDGET_COLORS = { background: 'ffffff', text: '1a1a1a', primary: '0a7f8f' } as const;

type CalendlyGlobal = {
  initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void;
};

declare global {
  interface Window {
    Calendly?: CalendlyGlobal;
  }
}

function buildWidgetUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('hide_gdpr_banner', '1');
    url.searchParams.set('background_color', WIDGET_COLORS.background);
    url.searchParams.set('text_color', WIDGET_COLORS.text);
    url.searchParams.set('primary_color', WIDGET_COLORS.primary);
    return url.toString();
  } catch {
    return null;
  }
}

export interface CalendlyEmbedProps {
  /** Overrides `NEXT_PUBLIC_CALENDLY_URL`; primarily for tests/storybook. */
  url?: string;
  className?: string;
  /** Widget height in px. Calendly recommends ~700 for a 30-min single-event booking. */
  minHeight?: number;
}

/**
 * Embeds the free Calendly inline scheduling widget — embed only, by design: the app has no
 * server-side Calendly integration of any kind (no PAT, no REST client, no webhook). A booking
 * made here happens entirely on Calendly's side, including Calendly's own confirmation email to
 * the visitor; nothing about it is recorded locally. If it should appear on the public Upcoming
 * Events tab, the admin adds it there manually (see modules/appointments/ui/appointment-form-dialog).
 * Renders a graceful empty state when no Calendly URL is configured so the page never crashes.
 */
export function CalendlyEmbed({ url, className, minHeight = 700 }: CalendlyEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const [initError, setInitError] = useState(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const regionLabelId = useId();

  // Calendly's iframe reports its real content height via postMessage (its own inline embed API);
  // without this the container height stays whatever we guessed and Calendly's iframe scrolls
  // internally instead of the page growing to fit it.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!event.origin.endsWith('calendly.com')) return;
      const data = event.data as { event?: string; payload?: { height?: number } };
      if (data?.event === 'calendly.page_height' && typeof data.payload?.height === 'number') {
        setContentHeight(data.payload.height);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const baseUrl = url ?? publicEnv.calendlyUrl;
  const widgetUrl = baseUrl ? buildWidgetUrl(baseUrl) : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!scriptReady || !widgetUrl || !container || !window.Calendly) return;

    try {
      container.replaceChildren();
      window.Calendly.initInlineWidget({ url: widgetUrl, parentElement: container });
      setInitialised(true);
    } catch {
      // Third-party widget script failed to initialise (bad URL, Calendly-side outage, etc.) — show
      // the empty state instead of leaving the loading spinner spinning forever.
      setInitError(true);
    }
  }, [scriptReady, widgetUrl]);

  if (!widgetUrl || initError) {
    return (
      <div
        role="status"
        className={cn(
          'flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/50 px-7 py-12',
          className,
        )}
      >
        <CalendarX2 className="mb-1 size-5 text-muted-foreground" aria-hidden="true" />
        <p className="font-serif text-lg text-foreground">The booking calendar didn&apos;t load</p>
        <p className="max-w-[58ch] text-pretty text-sm leading-relaxed text-muted-foreground">
          Reloading the page usually fixes this. If it keeps happening, the scheduling link has
          not been configured yet.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby={regionLabelId} className={cn('relative', className)}>
      <h2 id={regionLabelId} className="sr-only">
        Calendly scheduling widget
      </h2>

      {!initialised && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-background"
          style={{ minHeight }}
        >
          <Loader2 className="size-6 animate-spin text-accent motion-reduce:animate-none" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Loading available times…</span>
        </div>
      )}

      {/*
        NOT the `calendly-inline-widget` class: that class name is Calendly's auto-scan hook for the
        declarative (data-url attribute) embed method. We use the imperative `initInlineWidget` JS
        API instead, but widget.js still auto-scans the DOM for that class at script-load time and
        crashes in its internal `parseOptions` (reads a `data-url` it expects to find) when the class
        is present without the attribute. Keeping this container un-matched avoids that crash.
      */}
      <div
        ref={containerRef}
        className="calendly-embed-container w-full rounded-lg"
        style={{ minWidth: 320, height: contentHeight ?? minHeight }}
        data-testid="calendly-inline-widget"
      />

      <Script
        src={CALENDLY_WIDGET_SRC}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
    </section>
  );
}
