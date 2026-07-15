import { useId, type ReactNode } from "react"

/**
 * Text tooltip shown on hover AND keyboard focus (group-focus-within),
 * so it's reachable without a mouse. The trigger must be focusable —
 * for a disabled-looking control, use aria-disabled (not the native
 * disabled attribute) so it still receives focus.
 */
export function Tooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-xs -translate-x-1/2 rounded border border-border bg-surface-2 px-2 py-1 text-small text-on-surface-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}
