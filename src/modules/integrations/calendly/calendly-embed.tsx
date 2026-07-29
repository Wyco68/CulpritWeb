'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { CalendarX2, Loader2 } from 'lucide-react';
import { publicEnv } from '@/modules/shared/lib/env';
import { cn } from '@/modules/shared/lib/utils';

const CALENDLY_WIDGET_SRC = 'https://assets.calendly.com/assets/external/widget.js';

// Theme colours are passed to Calendly as hex without the leading '#'. They mirror the app's
// accent/background tokens so the embedded widget blends with light and dark themes.
const THEME_COLORS = {
  light: { background: 'ffffff', text: '1a1a1a', primary: '0a7f8f' },
  dark: { background: '0e1116', text: 'e5e7eb', primary: '22d3ee' },
} as const;

type CalendlyGlobal = {
  initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void;
};

declare global {
  interface Window {
    Calendly?: CalendlyGlobal;
  }
}

function buildWidgetUrl(baseUrl: string, theme: 'light' | 'dark'): string | null {
  try {
    const url = new URL(baseUrl);
    const colors = THEME_COLORS[theme];
    url.searchParams.set('hide_gdpr_banner', '1');
    url.searchParams.set('background_color', colors.background);
    url.searchParams.set('text_color', colors.text);
    url.searchParams.set('primary_color', colors.primary);
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
 * Embeds the free Calendly inline scheduling widget (embed + metadata only — no webhooks/sync).
 * Theme-aware, re-initialising when the resolved theme changes. Renders a graceful empty state
 * when no Calendly URL is configured so the page never crashes.
 */
export function CalendlyEmbed({ url, className, minHeight = 700 }: CalendlyEmbedProps) {
  const t = useTranslations('appointment.calendly');
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const regionLabelId = useId();

  const baseUrl = url ?? publicEnv.calendlyUrl;
  // `resolvedTheme` is undefined until next-themes hydrates; default to light to avoid a flash.
  const theme: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light';
  const widgetUrl = baseUrl ? buildWidgetUrl(baseUrl, theme) : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!scriptReady || !widgetUrl || !container || !window.Calendly) return;

    // Re-initialise on theme change: clear any prior iframe, then mount fresh.
    container.replaceChildren();
    window.Calendly.initInlineWidget({ url: widgetUrl, parentElement: container });
    setInitialised(true);
  }, [scriptReady, widgetUrl]);

  if (!widgetUrl) {
    return (
      <div
        role="status"
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/30 px-6 py-16 text-center',
          className,
        )}
      >
        <CalendarX2 className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-base font-medium text-foreground">{t('unavailableTitle')}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t('unavailableBody')}</p>
      </div>
    );
  }

  return (
    <section aria-labelledby={regionLabelId} className={cn('relative', className)}>
      <h2 id={regionLabelId} className="sr-only">
        {t('regionLabel')}
      </h2>

      {!initialised && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-background"
          style={{ minHeight }}
        >
          <Loader2 className="size-6 animate-spin text-accent motion-reduce:animate-none" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">{t('loading')}</span>
        </div>
      )}

      <div
        ref={containerRef}
        className="calendly-inline-widget w-full overflow-hidden rounded-lg"
        style={{ minWidth: 320, minHeight }}
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
