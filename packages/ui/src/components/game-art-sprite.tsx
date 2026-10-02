'use client';

/**
 * The SVG sprite with every game's key art. A client component on purpose: the browser draws it
 * from a few props (and the same seeded shapes as the server), so pages do not also carry the
 * drawing in their React payload.
 */
import type { GameAccent, GameArtMotif } from '@gamepulse/domain';
import type { ReactNode } from 'react';
import { artId, H, seeded, W, type GameArtSpec } from './game-art';

interface ArtPalette {
  /** Background gradient, top-left → bottom-right. */
  bg: readonly [string, string];
  glow: string;
  /** Main motif colour. */
  ink: string;
  /** Secondary highlight colour. */
  highlight: string;
}

const ART_PALETTES: Readonly<Record<GameAccent, ArtPalette>> = {
  sky: { bg: ['#04132b', '#0b4a7c'], glow: '#38bdf8', ink: '#bae6fd', highlight: '#d6b46a' },
  amber: { bg: ['#170d04', '#6b3d0c'], glow: '#f59e0b', ink: '#fde68a', highlight: '#fcd34d' },
  orange: { bg: ['#0e3a75', '#3aa0e6'], glow: '#fed7aa', ink: '#f97316', highlight: '#facc15' },
  teal: { bg: ['#041723', '#0d5560'], glow: '#2dd4bf', ink: '#ccfbf1', highlight: '#fcd34d' },
  violet: { bg: ['#0d0826', '#43218a'], glow: '#a78bfa', ink: '#ddd6fe', highlight: '#67e8f9' },
  rose: { bg: ['#1f0612', '#7f1d3f'], glow: '#fb7185', ink: '#ffe4e6', highlight: '#fda4af' },
  lime: { bg: ['#070806', '#1c2a07'], glow: '#a3e635', ink: '#d9f99d', highlight: '#facc15' },
  indigo: { bg: ['#080b26', '#2e3192'], glow: '#818cf8', ink: '#e0e7ff', highlight: '#f0abfc' },
};

const round = (value: number) => Math.round(value * 10) / 10;

function polygon(cx: number, cy: number, radii: readonly number[], rotation = 0): string {
  const step = (Math.PI * 2) / radii.length;
  return radii
    .map((r, i) => {
      const angle = rotation + i * step;
      return `${round(cx + r * Math.cos(angle))},${round(cy + r * Math.sin(angle))}`;
    })
    .join(' ');
}

const hexagon = (cx: number, cy: number, r: number) =>
  polygon(cx, cy, [r, r, r, r, r, r], -Math.PI / 2);

/** Four-point sparkle centred on 0,0 with radius 10. */
const SPARKLE =
  'M0-10C1.4-1.4 1.4-1.4 10 0C1.4 1.4 1.4 1.4 0 10C-1.4 1.4-1.4 1.4-10 0C-1.4-1.4-1.4-1.4 0-10Z';
/** Stylised maple leaf (five serrated lobes and a stem) in a 100×100 box. */
const LEAF =
  'M50 4 56 20 64 14 62 30 76 22 74 34 90 30 82 44 96 48 80 56 86 66 68 64 70 76 56 68 52 80 52 96 48 96 48 80 44 68 30 76 32 64 14 66 20 56 4 48 18 44 10 30 26 34 24 22 38 30 36 14 44 20Z';

type Motif = (rng: () => number, palette: ArtPalette, id: string) => ReactNode;

const MOTIFS: Readonly<Record<GameArtMotif, Motif>> = {
  hextech(rng, p, id) {
    const r = 26;
    const dx = Math.sqrt(3) * r;
    const lit = Array.from({ length: 7 }, (_, i) => {
      const row = Math.floor(rng() * 7);
      const col = Math.floor(rng() * 10);
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      return (
        <polygon
          key={i}
          points={hexagon(cx, row * r * 1.5, r - 2)}
          fill={p.glow}
          fillOpacity={0.12 + rng() * 0.14}
        />
      );
    });
    const cx = 330 + rng() * 60;
    const cy = 120 + rng() * 40;
    return (
      <>
        <defs>
          <pattern id={`${id}-hex`} width={round(dx)} height={r * 3} patternUnits="userSpaceOnUse">
            <path
              d={`M${round(dx / 2)} 2 L${round(dx - 1)} ${r / 2 + 1} L${round(dx - 1)} ${r * 1.5 - 1} L${round(dx / 2)} ${r * 2 - 2} L1 ${r * 1.5 - 1} L1 ${r / 2 + 1}Z M0 ${r * 2} L0 ${r * 3} M${round(dx)} ${r * 2} L${round(dx)} ${r * 3}`}
              fill="none"
              stroke={p.ink}
              strokeOpacity={0.12}
              strokeWidth={1.2}
            />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={`url(#${id}-hex)`} />
        {lit}
        <circle
          cx={cx}
          cy={cy}
          r={92}
          fill="none"
          stroke={p.highlight}
          strokeOpacity={0.55}
          strokeWidth={3}
        />
        <circle
          cx={cx}
          cy={cy}
          r={70}
          fill="none"
          stroke={p.highlight}
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeDasharray="6 8"
        />
        <polygon
          points={hexagon(cx, cy, 44)}
          fill={p.glow}
          fillOpacity={0.22}
          stroke={p.ink}
          strokeOpacity={0.7}
          strokeWidth={2}
        />
        <polygon
          points={polygon(cx, cy, [16, 6, 16, 6, 16, 6, 16, 6], -Math.PI / 2)}
          fill={p.highlight}
          fillOpacity={0.9}
        />
        <path
          d={`M0 ${H} L${W * 0.55} 0 L${W * 0.62} 0 L${W * 0.08} ${H}Z`}
          fill={p.ink}
          fillOpacity={0.05}
        />
      </>
    );
  },

  compass(rng, p) {
    const cx = 340 + rng() * 40;
    const cy = 150 + rng() * 30;
    const minor = (2 * Math.PI * 126) / 72;
    const major = (2 * Math.PI * 121) / 8;
    const ticks = (
      <>
        <circle
          cx={cx}
          cy={cy}
          r={126}
          fill="none"
          stroke={p.ink}
          strokeOpacity={0.3}
          strokeWidth={8}
          strokeDasharray={`1 ${round(minor - 1)}`}
        />
        <circle
          cx={cx}
          cy={cy}
          r={121}
          fill="none"
          stroke={p.ink}
          strokeOpacity={0.6}
          strokeWidth={18}
          strokeDasharray={`2 ${round(major - 2)}`}
        />
      </>
    );
    const rose = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? (i % 4 === 0 ? 96 : 60) : 14));
    return (
      <>
        {[180, 150, 130, 84].map((r, i) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={p.ink}
            strokeOpacity={0.12 + i * 0.08}
            strokeWidth={i === 2 ? 2 : 1}
          />
        ))}
        {ticks}
        <polygon
          points={polygon(cx, cy, rose, -Math.PI / 2)}
          fill={p.highlight}
          fillOpacity={0.85}
        />
        <polygon
          points={polygon(
            cx,
            cy,
            rose.map((r) => r * 0.55),
            -Math.PI / 2 + Math.PI / 8,
          )}
          fill={p.bg[0]}
          fillOpacity={0.55}
        />
        <circle cx={cx} cy={cy} r={7} fill={p.bg[0]} stroke={p.highlight} strokeWidth={2} />
        <path
          d={`M0 ${H - 40} Q${W * 0.3} ${H - 90} ${W * 0.62} ${H - 20}`}
          fill="none"
          stroke={p.ink}
          strokeOpacity={0.25}
          strokeWidth={1.5}
          strokeDasharray="2 7"
        />
      </>
    );
  },

  maple(rng, p, id) {
    const colors = [p.ink, p.highlight, '#ef4444', p.ink];
    const leaves = Array.from({ length: 14 }, (_, i) => {
      const size = 24 + rng() * 56;
      const x = rng() * (W + 40) - 20;
      const y = rng() * (H + 40) - 20;
      return (
        <use
          key={i}
          href={`#${id}-leaf`}
          transform={`translate(${round(x)} ${round(y)}) rotate(${round(rng() * 360)}) scale(${round(size / 100)}) translate(-50 -50)`}
          fill={colors[i % colors.length]}
          fillOpacity={0.6 + rng() * 0.4}
        />
      );
    });
    return (
      <>
        <defs>
          <path id={`${id}-leaf`} d={LEAF} />
        </defs>
        <circle cx={360} cy={70} r={74} fill="#fff7ed" fillOpacity={0.18} />
        <circle cx={360} cy={70} r={48} fill="#fffbeb" fillOpacity={0.85} />
        <ellipse cx={120} cy={238} rx={200} ry={62} fill="#ffffff" fillOpacity={0.18} />
        <ellipse cx={400} cy={252} rx={170} ry={52} fill="#ffffff" fillOpacity={0.12} />
        {leaves}
      </>
    );
  },

  stars(rng, p, id) {
    const points = Array.from({ length: 9 }, () => ({
      x: 40 + rng() * (W - 80),
      y: 30 + rng() * (H - 60),
    }));
    const sparkles = Array.from({ length: 18 }, (_, i) => (
      <use
        key={i}
        href={`#${id}-spark`}
        transform={`translate(${round(rng() * W)} ${round(rng() * H)}) scale(${round(0.3 + rng() * (i < 4 ? 2.2 : 0.8))})`}
        fill={i < 4 ? p.highlight : p.ink}
        fillOpacity={0.5 + rng() * 0.5}
      />
    ));
    return (
      <>
        <defs>
          <path id={`${id}-spark`} d={SPARKLE} />
        </defs>
        <circle cx={380} cy={80} r={46} fill={p.ink} fillOpacity={0.9} />
        <circle cx={398} cy={70} r={42} fill={p.bg[1]} />
        <polyline
          points={points.map((pt) => `${round(pt.x)},${round(pt.y)}`).join(' ')}
          fill="none"
          stroke={p.ink}
          strokeOpacity={0.3}
          strokeWidth={1}
        />
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={round(pt.x)}
            cy={round(pt.y)}
            r={2.4}
            fill={p.ink}
            fillOpacity={0.8}
          />
        ))}
        {sparkles}
      </>
    );
  },

  waves(rng, p) {
    const bands: ReactNode[] = [];
    for (let i = 0; i < 6; i += 1) {
      const base = 120 + i * 26;
      const amp = 10 + rng() * 18;
      const freq = (Math.PI * 2) / (220 + rng() * 140);
      const phase = rng() * Math.PI * 2;
      let d = `M0 ${H}`;
      for (let x = 0; x <= W; x += 16)
        d += ` L${x} ${round(base + amp * Math.sin(freq * x + phase))}`;
      d += ` L${W} ${H}Z`;
      bands.push(
        <path key={i} d={d} fill={i % 2 ? p.glow : p.ink} fillOpacity={0.08 + i * 0.05} />,
      );
    }
    const crest = Array.from({ length: 31 }, (_, i) => {
      const x = i * 16;
      return `${x},${round(110 + 16 * Math.sin(x / 38))}`;
    }).join(' ');
    return (
      <>
        <circle cx={110} cy={70} r={40} fill={p.highlight} fillOpacity={0.25} />
        <circle cx={110} cy={70} r={18} fill={p.highlight} fillOpacity={0.6} />
        {bands}
        <polyline
          points={crest}
          fill="none"
          stroke={p.highlight}
          strokeOpacity={0.8}
          strokeWidth={2.5}
        />
      </>
    );
  },

  hazard(rng, p, id) {
    const cx = 330 + rng() * 60;
    return (
      <>
        <defs>
          <pattern id={`${id}-grid`} width={30} height={30} patternUnits="userSpaceOnUse">
            <path d="M30 0H0V30" fill="none" stroke={p.ink} strokeOpacity={0.08} />
          </pattern>
          <pattern
            id={`${id}-stripes`}
            width={36}
            height={36}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width={36} height={36} fill="#111111" />
            <rect width={18} height={36} fill={p.highlight} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={`url(#${id}-grid)`} />
        <path
          d={`M0 ${H - 70} L${W} ${H - 130} L${W} ${H - 95} L0 ${H - 35}Z`}
          fill={`url(#${id}-stripes)`}
        />
        <circle cx={cx} cy={95} r={58} fill="none" stroke={p.glow} strokeWidth={6} />
        <circle
          cx={cx}
          cy={95}
          r={36}
          fill="none"
          stroke={p.glow}
          strokeOpacity={0.5}
          strokeWidth={2}
        />
        <rect x={cx - 9} y={86} width={18} height={18} fill={p.glow} />
      </>
    );
  },
};

/** Renders every game's art once per page (include it in the root layout). */
export function GameArtSprite({ games }: { games: readonly GameArtSpec[] }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      {games.map(({ gameId, accent, motif }) => {
        const id = artId(gameId);
        const palette = ART_PALETTES[accent];
        const rng = seeded(gameId);
        const glowX = round(0.55 + rng() * 0.3);
        const glowY = round(0.2 + rng() * 0.3);
        return (
          <symbol
            key={gameId}
            id={id}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={palette.bg[0]} />
                <stop offset="1" stopColor={palette.bg[1]} />
              </linearGradient>
              <radialGradient id={`${id}-glow`} cx={glowX} cy={glowY} r="0.65">
                <stop offset="0" stopColor={palette.glow} stopOpacity="0.55" />
                <stop offset="1" stopColor={palette.glow} stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill={`url(#${id}-bg)`} />
            <rect width={W} height={H} fill={`url(#${id}-glow)`} />
            {MOTIFS[motif](rng, palette, id)}
          </symbol>
        );
      })}
    </svg>
  );
}
