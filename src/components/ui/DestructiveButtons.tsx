import { Tooltip } from "./Tooltip"

/* ── Icons (currentColor) ───────────────────────────────────────────── */

/** Minus-in-circle: "clear this slot" — light, reversible. */
function MinusCircleIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M5 8h6" />
    </svg>
  )
}

/** Circle-slash (⊘): "I don't possess this" — permanent, cautionary. */
function NoEntryIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M4 12 12 4" />
    </svg>
  )
}

/**
 * TEMPORARY, build-scoped: empties a slot for the current build only,
 * resets on preset/tab change. Deliberately LIGHT — a thin ghost with
 * a minus glyph, low weight — so it reads as minor and reversible.
 *
 * Disabled (weapon slot; Susie's last armor) uses aria-disabled so it
 * stays focusable and its tooltip is keyboard-reachable, with a dashed
 * border marking it non-interactive beyond color.
 */
export function RemoveButton({
  onClick,
  disabled = false,
  disabledReason,
}: {
  onClick?: () => void
  disabled?: boolean
  disabledReason?: string
}) {
  const button = (
    <button
      type="button"
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-small font-normal transition-colors " +
        (disabled
          ? "cursor-not-allowed border-dashed border-border text-text-muted"
          : "border-border text-text-muted hover:bg-surface-2 hover:text-on-surface")
      }
    >
      <MinusCircleIcon />
      Remove
    </button>
  )
  return disabled && disabledReason ? (
    <Tooltip label={disabledReason}>{button}</Tooltip>
  ) : (
    button
  )
}

/**
 * PERMANENT, dataset-scoped: writes owned:0, changing every future
 * optimization. Deliberately HEAVIER — a warning-tinted fill, warning
 * border, bold weight, and a circle-slash glyph — so the stakes read
 * at a glance and it can't be mistaken for the light Remove.
 */
export function MarkUnavailableButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border border-warning bg-warning/10 px-2 py-0.5 text-small font-semibold text-warning transition-colors hover:bg-warning/20 active:bg-warning/25"
    >
      <NoEntryIcon />
      I don&apos;t have this
    </button>
  )
}
