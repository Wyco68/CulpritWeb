import { cn } from '@/modules/shared/lib/utils';

// The masthead's ornament (ADR-018): a guilloché rosette, the interlaced linework engraved on
// banknotes and passports so a document is hard to forge. Generated, not drawn — each ring is one
// closed wave, r(θ) = R + a·sin(kθ), repeated a few times at small rotations so the copies cross
// and weave. Only the base wave is emitted as path data; the copies are <use> references, which
// keeps the whole rosette to a few kilobytes of markup.
//
// Computed once at module load on the server. Purely decorative: hidden from assistive tech, never
// focusable, and coloured by `currentColor` so the caller picks the ink.

type Ring = { radius: number; amplitude: number; petals: number; copies: number };

const RINGS: readonly Ring[] = [
  { radius: 172, amplitude: 16, petals: 30, copies: 5 },
  { radius: 128, amplitude: 20, petals: 20, copies: 5 },
  { radius: 84, amplitude: 16, petals: 14, copies: 4 },
  { radius: 44, amplitude: 12, petals: 9, copies: 4 },
];

/** Samples per wave period — enough that no facet shows at the size the masthead renders. */
const SAMPLES_PER_PETAL = 12;

function wavePath({ radius, amplitude, petals }: Ring): string {
  const steps = petals * SAMPLES_PER_PETAL;
  const points: string[] = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = radius + amplitude * Math.sin(petals * theta);
    points.push(`${(r * Math.cos(theta)).toFixed(1)} ${(r * Math.sin(theta)).toFixed(1)}`);
  }
  return `M${points.join('L')}Z`;
}

const PATHS = RINGS.map(wavePath);

export function Guilloche({ id = 'guilloche', className }: { id?: string; className?: string }) {
  return (
    <svg
      viewBox="-200 -200 400 400"
      aria-hidden="true"
      focusable="false"
      className={cn('pointer-events-none', className)}
    >
      <defs>
        {PATHS.map((d, index) => (
          // `vector-effect` is not inherited, so it goes on the path itself; every <use> clone
          // copies it and the lines stay one device pixel wide at any rendered size.
          <path key={index} id={`${id}-${index}`} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth={1}>
        {RINGS.map((ring, index) =>
          Array.from({ length: ring.copies }, (_, copy) => (
            <use
              key={`${index}-${copy}`}
              href={`#${id}-${index}`}
              transform={`rotate(${((360 / ring.petals / ring.copies) * copy).toFixed(2)})`}
            />
          )),
        )}
      </g>
    </svg>
  );
}
