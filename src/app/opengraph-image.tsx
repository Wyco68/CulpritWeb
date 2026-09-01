import { ImageResponse } from 'next/og';

// Server-generated brand card for link previews (Open Graph + Twitter/X — see twitter-image.tsx,
// which re-exports this). Deliberately generic: site name + tagline only, no photo or invented
// personal/business copy.
//
// Colours are hardcoded because CSS custom properties aren't available inside `ImageResponse`'s
// isolated Satori renderer. This stays a dark card by design even though the live `--masthead`
// band is light cyan: a social-preview card needs strong contrast against arbitrary feed
// backgrounds, so it intentionally doesn't mirror the on-site palette.
//
// Laid out left-aligned against a rule, the same editorial structure the site's own pages use,
// rather than as a centred logo card.

const CARD_BACKGROUND = 'hsl(215, 59%, 11%)';
const CARD_FOREGROUND = 'hsl(210, 20%, 92%)';
const CARD_ACCENT = 'hsl(190, 90%, 55%)';
const CARD_MUTED = 'hsl(210, 16%, 72%)';

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
          justifyContent: 'flex-end',
          padding: 88,
          backgroundColor: CARD_BACKGROUND,
          color: CARD_FOREGROUND,
          fontFamily: 'serif',
        }}
      >
        {/* The same short accent rule that marks the start of every section on the site. */}
        <div style={{ display: 'flex', width: 64, height: 3, backgroundColor: CARD_ACCENT }} />

        <div
          style={{
            display: 'flex',
            marginTop: 40,
            fontSize: 128,
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          The Culprit
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 30,
            color: CARD_MUTED,
          }}
        >
          Information security research, teaching, and supervision
        </div>
      </div>
    ),
    { ...size },
  );
}
