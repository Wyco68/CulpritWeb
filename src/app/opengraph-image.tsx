import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { DEFAULT_LAB_NAME, getProfileCached } from '@/modules/profile';
import { SITE_URL } from '@/modules/shared/lib/site-url';
import { GUILLOCHE_STROKES } from '@/modules/shared/ui/guilloche';

// The card a shared link unfurls into (Open Graph, and Twitter/X via twitter-image.tsx). It is the
// site's masthead (ADR-018) at card size: the pale green band with its soft lift and guilloché
// rosette, and the lab's own name, tagline and affiliation read from the profile — so a preview
// always says what the header says, and an admin edit reaches it with the same `('/', 'layout')`
// revalidation that refreshes the header.
//
// Colours are the resolved values of the masthead tokens in globals.css — CSS custom properties
// don't exist inside `ImageResponse`'s renderer. Keep the two in step.
const BAND = 'hsl(150, 35%, 91%)'; // --masthead
const BAND_RAISED = 'hsl(150, 40%, 95%)'; // --masthead-raised
// The lift fades to the band itself at zero alpha: plain `transparent` is transparent black here,
// and the gradient greys out on its way to it.
const BAND_CLEAR = 'hsla(150, 35%, 91%, 0)';
const INK = 'hsl(150, 30%, 15%)'; // --masthead-foreground, 11.67:1 on the band
const INK_SOFT = 'hsla(150, 30%, 15%, 0.75)'; // the affiliation line, 5.6:1
const ACCENT = 'hsl(158, 55%, 27%)'; // --accent-on-band, 5.46:1
const ENGRAVING = 'hsl(155, 35%, 42%)'; // --engraving

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = "The lab's name, tagline and affiliation on its pale green masthead.";

// The same daily safety net as the public layout; profile edits refresh it on demand.
export const revalidate = 86400;

// Static instances of the site's two families — the renderer takes TTF/OTF data, not the woff2
// next/font serves. Newsreader is cut at its 72pt optical size, the one meant for display type.
// Listed in next.config.ts's `outputFileTracingIncludes` so the standalone build carries them.
const FONT_DIR = join(process.cwd(), 'src/app/_og/fonts');
const fonts = Promise.all([
  readFile(join(FONT_DIR, 'Newsreader-Display-Regular.ttf')),
  readFile(join(FONT_DIR, 'Newsreader-Display-Italic.ttf')),
  readFile(join(FONT_DIR, 'SchibstedGrotesk-Medium.ttf')),
]);

/** Steps the name down as it grows, so even a long one stays within three lines beside the rosette. */
function nameSize(name: string): number {
  if (name.length <= 24) return 96;
  if (name.length <= 44) return 80;
  return 64;
}

export default async function OpengraphImage() {
  const [[serif, serifItalic, sans], result] = await Promise.all([fonts, getProfileCached()]);
  const profile = result.ok ? result.data : null;
  const labName = profile?.labName || DEFAULT_LAB_NAME;

  return new ImageResponse(
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '72px 88px',
        backgroundColor: BAND,
        backgroundImage: `radial-gradient(ellipse 60% 90% at 88% 20%, ${BAND_RAISED}, ${BAND_CLEAR} 70%)`,
        color: INK,
      }}
    >
      {/* The masthead's rosette, off the right edge as it sits on the site, faded out toward the
          text the same way the header masks it, so the linework never crowds a long name. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 760,
          height: size.height,
          display: 'flex',
          maskImage: 'linear-gradient(to right, transparent, black 60%)',
        }}
      >
        <svg
          width={820}
          height={820}
          viewBox="-200 -200 400 400"
          style={{ position: 'absolute', right: -270, top: -95 }}
        >
          <g fill="none" stroke={ENGRAVING} strokeWidth={0.45} strokeOpacity={0.4}>
            {GUILLOCHE_STROKES.map((stroke, index) => (
              <path key={index} d={stroke.d} transform={`rotate(${stroke.rotate})`} />
            ))}
          </g>
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 780 }}>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Newsreader',
            fontSize: nameSize(labName),
            lineHeight: 1.02,
            letterSpacing: -1.5,
          }}
        >
          {labName}
        </div>

        {profile?.labTagline && (
          <div
            style={{
              display: 'flex',
              marginTop: 20,
              fontFamily: 'Newsreader',
              fontStyle: 'italic',
              fontSize: 40,
              color: ACCENT,
            }}
          >
            {profile.labTagline}
          </div>
        )}

        <div
          style={{ display: 'flex', width: 64, height: 3, marginTop: 40, backgroundColor: ACCENT }}
        />

        {profile?.positionAffiliation && (
          <div
            style={{
              display: 'flex',
              marginTop: 24,
              fontFamily: 'Schibsted Grotesk',
              fontSize: 26,
              lineHeight: 1.4,
              color: INK_SOFT,
            }}
          >
            {profile.positionAffiliation}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 88,
          bottom: 48,
          display: 'flex',
          fontFamily: 'Schibsted Grotesk',
          fontSize: 22,
          letterSpacing: 0.5,
          color: INK_SOFT,
        }}
      >
        {new URL(SITE_URL).host.replace(/^www\./, '')}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Newsreader', data: serif, style: 'normal', weight: 400 },
        { name: 'Newsreader', data: serifItalic, style: 'italic', weight: 400 },
        { name: 'Schibsted Grotesk', data: sans, style: 'normal', weight: 500 },
      ],
    },
  );
}
