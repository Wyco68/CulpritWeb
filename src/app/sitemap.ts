import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/modules/shared/lib/site-url';

// Only the 6 public tabs are indexable content — admin, login, and API routes are deliberately
// excluded (see robots.ts). Priorities are standard defaults, not measured data: the homepage
// (About) is the canonical entry point and gets the highest weight.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/research`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/publications`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/team`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/events`, lastModified, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/appointment`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
