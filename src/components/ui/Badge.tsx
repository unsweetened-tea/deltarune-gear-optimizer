import type { ReactNode } from "react"
import type { Stats } from "../../types/data"
import { STAT_TEXT_CLASS } from "../../lib/statColors"

/** Neutral chip for labels/metadata. */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-surface-2 px-2 py-0.5 text-mono font-mono text-on-surface-2">
      {children}
    </span>
  )
}

/**
 * A stat-coded chip: the stat's D0 hue carries the meaning, so HP reads
 * green, ATK orange, DEF blue, Magic purple. Never collapse to one accent.
 */
export function StatBadge({
  stat,
  value,
}: {
  stat: keyof Stats
  value: number | string
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded bg-surface-2 px-2 py-0.5 ${STAT_TEXT_CLASS[stat]}`}
    >
      <span className="text-small font-medium uppercase">{stat}</span>
      <span className="font-mono text-mono font-bold tabular-nums">
        {value}
      </span>
    </span>
  )
}
