import { useId } from 'react';

/** Logo « 7e ciel » : nuage kawaii avec un croissant de lune et une étoile (docs/CHARTE.md). Jamais accompagné du nom. */
export function Logo({ size = 40, title = 'Second Cerveau' }: { size?: number; title?: string }) {
  const id = useId().replace(/:/g, '');
  const g = `sky-g-${id}`;
  const h = `sky-h-${id}`;
  const m = `moon-${id}`;
  const cloud = 'M8.6 26.5 A5.4 5.4 0 0 1 6.4 16.4 A7.6 7.6 0 0 1 20.6 12.6 A6 6 0 0 1 27.4 19.6 A3.9 3.9 0 0 1 25.4 26.5 Z';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9E5FF" />
          <stop offset="1" stopColor="#4FA6EC" />
        </linearGradient>
        <radialGradient id={h} cx=".35" cy=".25" r=".5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".7" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <mask id={m}>
          <rect width="32" height="32" fill="white" />
          <circle cx="26.2" cy="4.2" r="3.2" fill="black" />
        </mask>
      </defs>
      <path d={cloud} fill={`url(#${g})`} />
      <path d={cloud} fill={`url(#${h})`} />
      <circle cx="13.4" cy="20" r=".95" fill="#142133" />
      <circle cx="19" cy="20" r=".95" fill="#142133" />
      <path d="M14.9 22.1 q1.3 1.2 2.6 0" fill="none" stroke="#142133" strokeWidth=".8" strokeLinecap="round" />
      <ellipse cx="11.4" cy="22" rx="1.2" ry=".7" fill="#CF5068" opacity=".7" />
      <ellipse cx="21" cy="22" rx="1.2" ry=".7" fill="#CF5068" opacity=".7" />
      <circle cx="24" cy="6" r="3.8" fill="#2A7AC4" mask={`url(#${m})`} />
      <path d="M26.4 2.55 L26.85 3.55 L27.85 4 L26.85 4.45 L26.4 5.45 L25.95 4.45 L24.95 4 L25.95 3.55 Z" fill="#2A7AC4" />
    </svg>
  );
}
