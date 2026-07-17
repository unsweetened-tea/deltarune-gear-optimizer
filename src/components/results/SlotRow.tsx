import type { ReactNode } from "react"
import type { Item } from "../../types/data"

function SparkIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <path d="M8 1 9.6 6.4 15 8l-5.4 1.6L8 15l-1.6-5.4L1 8l5.4-1.6z" />
    </svg>
  )
}

/**
 * One equipment slot on a loadout card. The item name reads as the
 * primary content; its ability sits directly beneath it (first-class,
 * since the optimizer never scores abilities); an optional `note` (the
 * M5 "why" line) gets readable presence; and the D2 action buttons sit
 * to the right, keeping their distinct treatment. An unfilled armor
 * slot renders as an intentional dashed placeholder, never blank.
 */
export function SlotRow({
  slotLabel,
  item,
  actions,
  note,
}: {
  slotLabel: string
  item?: Item
  actions?: ReactNode
  note?: ReactNode
}) {
  if (!item) {
    return (
      <div className="rounded border border-dashed border-border px-3 py-2">
        <div className="text-small uppercase tracking-wide text-text-muted">
          {slotLabel}
        </div>
        <div className="text-small italic text-text-muted">empty</div>
      </div>
    )
  }

  return (
    <div className="rounded border border-border bg-surface-2/40 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-small uppercase tracking-wide text-text-muted">
            {slotLabel}
          </div>
          <div className="font-medium text-on-surface">{item.name}</div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {actions}
          </div>
        )}
      </div>

      {item.ability &&
        (item.ability.name || item.ability.description) && (
          <div className="mt-1.5 flex gap-1.5 text-small text-on-surface-2">
            <span className="text-warning">
              <SparkIcon />
            </span>
            <span>
              {item.ability.name && (
                <span className="font-medium text-warning">
                  {item.ability.name}
                </span>
              )}
              {item.ability.name && item.ability.description ? " — " : ""}
              {item.ability.description}
            </span>
          </div>
        )}

      {note && (
        <div className="mt-1.5 border-l-2 border-border pl-2 text-small text-on-surface">
          {note}
        </div>
      )}
    </div>
  )
}
