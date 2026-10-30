/** A small list of named colour swatches; renders nothing when there are none. */
export function Dots({ colors }: { colors: { name: string; hex: string }[] }) {
  if (colors.length === 0) return null;
  return (
    <ul className="swatches" aria-label="Colours">
      {colors.map((c) => (
        <li key={`${c.name}-${c.hex}`}>
          <span className="swatch" style={{ background: c.hex }} aria-hidden="true" />
          {c.name}
        </li>
      ))}
    </ul>
  );
}
