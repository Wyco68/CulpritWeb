import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Images from the R2/object-store bucket. Add the R2 public host once known.
  images: {
    remotePatterns: [
      // { protocol: 'https', hostname: '<your-r2-public-host>' },
    ],
  },
};

export default withNextIntl(nextConfig);
