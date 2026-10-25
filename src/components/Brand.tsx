/**
 * Shubā artwork: the petal rangoli mark, the wordmark logo and the toran.
 * All drawings are decorative (aria-hidden) unless they carry the name.
 */

export const PETAL_PATH = "M0 -6 C 7 -14, 7 -24, 0 -30 C -7 -24, -7 -14, 0 -6 Z";
export const PETAL_COUNT = 6;

interface MarkProps {
  /** How many petals are filled with colour, after the always-gold first petal (0–5). */
  filled?: number;
  size?: number;
  className?: string;
  /** Petal index that just filled, for the bloom animation. */
  blooming?: number | null;
}

/**
 * The rangoli mark. Petal 0 is always gold (the small touch that is always on);
 * the other petals fill teal and gold in turn as milestones are reached.
 */
export function PetalMark({ filled = 0, size = 72, className = "", blooming = null }: MarkProps) {
  return (
    <svg
      className={`petal-mark ${className}`}
      viewBox="0 0 72 72"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(36 36)" strokeLinecap="round" strokeLinejoin="round">
        {Array.from({ length: PETAL_COUNT }, (_, i) => {
          const isFilled = i === 0 || i <= filled;
          const tone = i === 0 ? "gold" : i % 2 === 1 ? "teal" : "gold";
          return (
            <path
              key={i}
              d={PETAL_PATH}
              transform={`rotate(${i * 60})`}
              className={`petal ${isFilled ? `petal-${tone}` : "petal-empty"} ${blooming === i ? "petal-bloom" : ""}`}
            />
          );
        })}
      </g>
      <circle cx="36" cy="36" r="3.5" className="petal-centre" />
    </svg>
  );
}

/** Header logo: mark plus the "Shubā" wordmark. */
export function Logo() {
  return (
    <span className="logo">
      <PetalMark size={36} />
      <span className="wordmark">Shubā</span>
    </span>
  );
}

/** A festive toran (door hanging) shown across the plan when everything is done. */
export function Toran() {
  const drops = Array.from({ length: 13 }, (_, i) => i);
  return (
    <svg className="toran" viewBox="0 0 260 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 4 Q130 22 260 4" className="toran-string" fill="none" />
      {drops.map((i) => {
        const x = 10 + i * 20;
        const y = 4 + 18 * (1 - ((x - 130) / 130) ** 2);
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M0 0 C 5 5, 5 12, 0 18 C -5 12, -5 5, 0 0 Z" className={i % 2 ? "toran-teal" : "toran-gold"} />
          </g>
        );
      })}
    </svg>
  );
}

/** A few petals that drift down once when a milestone is reached. */
export function PetalShower() {
  return (
    <span className="petal-shower" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <svg key={i} viewBox="-8 -32 16 28" className={`shower-petal shower-${i}`} focusable="false">
          <path d={PETAL_PATH} />
        </svg>
      ))}
    </span>
  );
}
