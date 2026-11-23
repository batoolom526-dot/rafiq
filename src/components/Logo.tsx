/* The Rafiq mark: gold serif R + ر sweep + ق dots inside a ring.
   Full mark above 40px; simplified mark (no ring/dots) for small sizes. */
const SWEEP = 'M184 56 C142 56 112 88 84 116 C64 135 42 148 12 152 C44 142 64 126 86 106 C114 80 144 58 184 56 Z';

export function LogoDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="rq-gold" gradientUnits="userSpaceOnUse" x1="20" y1="170" x2="180" y2="30">
          <stop offset="0" stopColor="#E2B04E" /><stop offset=".3" stopColor="#F7E29A" /><stop offset=".5" stopColor="#F3EEE2" />
          <stop offset=".72" stopColor="#D4AC55" /><stop offset="1" stopColor="#94681F" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ size = 34, full = size >= 40, tile = true }: { size?: number; full?: boolean; tile?: boolean }) {
  const R = (
    <text x="97" y="137" textAnchor="middle" fontFamily="'Cormorant Garamond',Georgia,'Times New Roman',serif" fontWeight={700} fontSize="114" fill="url(#rq-gold)">R</text>
  );
  const sweep = <path d={SWEEP} fill="url(#rq-gold)" stroke="var(--tile)" strokeWidth={full ? 6 : 7} paintOrder="stroke" strokeLinejoin="round" />;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Rafiq">
      {tile && <rect width="200" height="200" rx="46" fill="var(--tile)" />}
      {full ? (
        <>
          <circle cx="100" cy="100" r="72" fill="none" stroke="url(#rq-gold)" strokeWidth="3.5" />
          {R}
          {sweep}
          <circle cx="146" cy="96" r="5.2" fill="url(#rq-gold)" />
          <circle cx="160" cy="96" r="5.2" fill="url(#rq-gold)" />
        </>
      ) : (
        <g transform="translate(100 100) scale(1.32) translate(-100 -100)">
          {R}
          {sweep}
        </g>
      )}
    </svg>
  );
}
