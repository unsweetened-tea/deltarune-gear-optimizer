/**
 * A delta value. Colour is paired with a ▲/▼ glyph and an explicit
 * +/− sign, so the direction is readable without relying on colour
 * (colourblind-safe). Zero renders as a calm em-dash.
 */
export function Delta({ value }: { value: number }) {
  if (value === 0) {
    return <span className="font-mono text-mono text-text-muted">—</span>
  }
  const positive = value > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-mono tabular-nums ${
        positive ? "text-success" : "text-warning"
      }`}
    >
      <span aria-hidden="true">{positive ? "▲" : "▼"}</span>
      {positive ? "+" : "−"}
      {Math.abs(value)}
    </span>
  )
}
