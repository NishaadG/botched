/**
 * A player's avatar: a 5x5 mirrored pixel glyph drawn from their alias, in their colour.
 * Same alias, same glyph, so players learn to recognise each other at a glance.
 */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function glyphCells(seed: string) {
  let h = hash(seed || "?");
  const cells: [number, number][] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      if (h % 100 < 52) {
        cells.push([x, y]);
        if (x < 2) cells.push([4 - x, y]);
      }
    }
  }
  // Never blank: keep at least a spine.
  if (cells.length < 4) for (let y = 0; y < 5; y++) cells.push([2, y]);
  return cells;
}

export function Sigil({
  seed,
  color = "#5d9466",
  size = 32,
  dim = false,
  className = "",
}: {
  seed: string;
  color?: string;
  size?: number;
  dim?: boolean;
  className?: string;
}) {
  const cells = glyphCells(seed);
  return (
    <span
      className={`grid shrink-0 place-items-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        background: `${color}14`,
        boxShadow: `inset 0 0 0 1px ${color}66`,
        opacity: dim ? 0.35 : 1,
        filter: dim ? "grayscale(1)" : undefined,
      }}
      aria-hidden
    >
      <svg viewBox="0 0 5 5" width={size * 0.62} height={size * 0.62} shapeRendering="crispEdges">
        {seed ? (
          cells.map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill={color} />)
        ) : (
          <rect x={2} y={2} width={1} height={1} fill={color} />
        )}
      </svg>
    </span>
  );
}

/** "Lime Frog" → "lime_frog", the in-game handle. */
export const handle = (alias: string) => alias.trim().toLowerCase().replace(/\s+/g, "_");
