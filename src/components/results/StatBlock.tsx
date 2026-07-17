import type { Stats } from "../../types/data"
import { STAT_RING_CLASS, STAT_TEXT_CLASS } from "../../lib/statColors"

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

/**
 * The four-stat reference block: each stat in its D0 hue and the mono
 * face, laid out on a fixed 4-column grid so figures align and scan
 * vertically across stacked cards. Calm by design — legible reference
 * data, not the loudest thing on the card. `highlight` rings one stat
 * (e.g. the M2 target) without shifting layout.
 */
export function StatBlock({
  totals,
  highlight,
}: {
  totals: Stats
  highlight?: keyof Stats
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {STAT_KEYS.map((stat) => (
        <div
          key={stat}
          className={`rounded bg-surface-2 px-2 py-1.5 text-center text-on-surface-2 ${
            highlight === stat ? STAT_RING_CLASS[stat] : ""
          }`}
        >
          <div
            className={`text-small font-medium uppercase ${STAT_TEXT_CLASS[stat]}`}
          >
            {stat}
          </div>
          <div
            className={`font-mono text-mono font-bold tabular-nums ${STAT_TEXT_CLASS[stat]}`}
          >
            {totals[stat]}
          </div>
        </div>
      ))}
    </div>
  )
}
