import { ImageResponse } from 'next/og';

// Server-generated brand card for link previews (Open Graph + Twitter/X — see twitter-image.tsx,
// which re-exports this). Deliberately generic: site name + tagline only, no photo or invented
// personal/business copy. Colors match the design system's navy/accent tokens (see globals.css
// `@theme inline`) since CSS custom properties aren't available inside `ImageResponse`'s isolated
// Satori renderer. Kept as a dark card by design even though the live `--navy` header is now
// light cyan — a social-preview card needs strong contrast against arbitrary feed backgrounds, so
// it intentionally doesn't chase every on-site palette tweak.

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          backgroundColor: 'hsl(215, 59%, 11%)',
          color: 'hsl(210, 20%, 92%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 22,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: 'hsl(190, 90%, 55%)',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '9999px',
              backgroundColor: 'hsl(190, 90%, 55%)',
            }}
          />
          Information Security Research
        </div>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>
          The Culprit
        </div>
      </div>
    ),
    { ...size },
  );
}
