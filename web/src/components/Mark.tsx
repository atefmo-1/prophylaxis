// The Prophylaxis mark: a plain pawn on an ink tile.
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="mark">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <g fill="var(--c-bg, #fff)" transform="translate(16 16.2) scale(1.18) translate(-16 -16.2)">
        <circle cx="16" cy="10.6" r="4" />
        <rect x="11.6" y="14.6" width="8.8" height="2.2" rx="1.1" />
        <path d="M13.4 16.6h5.2c0 2.7 1 4.7 2.9 6.6H10.5c1.9-1.9 2.9-3.9 2.9-6.6z" />
        <rect x="9.6" y="23" width="12.8" height="2.8" rx="1.4" />
      </g>
    </svg>
  );
}
