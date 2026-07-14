import type { UnavailableEntry } from "../hooks/useMarkUnavailable"

/** The reversible "recently marked unavailable" list shown by every optimizer tab. */
export function RecentlyUnavailable({
  entries,
  onUndo,
}: {
  entries: UnavailableEntry[]
  onUndo: (entry: UnavailableEntry) => void
}) {
  if (entries.length === 0) return null
  return (
    <div className="rounded-card border border-border bg-surface-2 p-3 text-small text-on-surface-2">
      <h3 className="text-small font-semibold text-text-muted uppercase">
        Recently marked unavailable (owned set to 0)
      </h3>
      <ul className="mt-1 space-y-1">
        {entries.map((entry, i) => (
          <li key={i} className="flex items-center gap-2">
            <span>{entry.itemName}</span>
            <button
              type="button"
              onClick={() => onUndo(entry)}
              className="rounded border border-border px-2 py-0.5 text-small text-on-surface-2 hover:border-soul hover:text-soul"
            >
              Undo
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
