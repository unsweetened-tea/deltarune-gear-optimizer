import { useId, useState, type ReactNode } from "react"

/**
 * Text tooltip shown on hover AND keyboard focus, so it's reachable
 * without a mouse. Visibility is driven by React state (not a CSS
 * group-hover class) because Tailwind v4 wraps group-variant parents
 * in :where(), which would tie with the base opacity and never show.
 * The trigger must be focusable — for a disabled-looking control, use
 * aria-disabled (not the native disabled attribute) so it takes focus.
 */
export function Tooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const id = useId()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const open = hovered || focused
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <span aria-describedby={id}>{children}</span>
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-xs -translate-x-1/2 rounded border border-border bg-surface-2 px-2 py-1 text-small text-on-surface-2 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        {label}
      </span>
    </span>
  )
}
