import { test, expect } from '@playwright/test';

// Public "Make Appointment" tab. The tab embeds Calendly only (no custom scheduler), and the
// embed is gated behind a Cloudflare Turnstile human check (GatedCalendlyEmbed): the widget mounts
// only after the check passes, which an automated browser may never do. So the spec asserts the
// page and the gate, not a booked slot. Read-only.
test.describe('Make Appointment page', () => {
  test('renders the page heading', async ({ page }) => {
    await page.goto('/appointment');

    // This page's own heading is an <h2>; the site shell's <h1> is the lab name in the header.
    // The intro paragraph beneath it is admin-edited copy, so it is not asserted here.
    await expect(page.getByRole('heading', { level: 2, name: 'Make Appointment' })).toBeVisible();
  });

  test('shows the human check, the booking widget, or its failure state', async ({ page }) => {
    await page.goto('/appointment');

    // Exactly one of the three is on screen at any moment: the Turnstile gate while it checks,
    // the Calendly container once it has passed, or the embed's own error state if Calendly
    // could not load.
    const gate = page.getByRole('heading', { name: /not a bot/i });
    const widget = page.getByTestId('calendly-inline-widget');
    const failed = page.getByText("The booking calendar didn't load");

    await expect(gate.or(widget).or(failed)).toBeVisible();
  });
});
