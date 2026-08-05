import { test, expect } from '@playwright/test';

// Public "Make Appointment" tab — direct-booking flow (spec FR-6/FR-7: the tab embeds Calendly
// only, no custom scheduler). `localePrefix: 'as-needed'` (src/i18n/routing.ts) serves the
// default 'en' locale at the bare path, so '/appointment' resolves without a redirect.
test.describe('Make Appointment page', () => {
  test('renders the page heading and the direct-booking section', async ({ page }) => {
    await page.goto('/appointment');

    // This page's own heading (src/app/[locale]/(public)/appointment/page.tsx) is an <h2> — the
    // site shell's <h1> is the professor's name, rendered by the shared SiteHeader and out of
    // scope for this page-level spec. The page has no separate "Book directly" heading in the
    // current markup (that copy key exists in messages/en.json but isn't wired up yet); the real
    // direct-booking copy lives in this subtitle, so we assert on that instead.
    await expect(page.getByRole('heading', { level: 2, name: 'Make Appointment' })).toBeVisible();
    await expect(page.getByText(/pick an open 30-minute slot/i)).toBeVisible();
  });

  test('mounts the Calendly embed container, or shows the unavailable empty state', async ({
    page,
  }) => {
    await page.goto('/appointment');

    // CalendlyEmbed (src/modules/integrations/calendly/calendly-embed.tsx) either mounts our own
    // container div (data-testid) that Calendly's widget.js populates, or — when no scheduling URL
    // is configured/reachable — renders our graceful "unavailable" empty state. We only assert on
    // our own DOM, never on Calendly's third-party iframe content, so this holds regardless of
    // whether the CI environment has network access to calendly.com.
    const widgetContainer = page.getByTestId('calendly-inline-widget');
    const emptyState = page.getByText('Scheduling is temporarily unavailable');

    await expect(widgetContainer.or(emptyState)).toBeVisible();
  });
});
