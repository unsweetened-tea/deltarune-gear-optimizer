import type { ReactNode } from "react"
import { SoulHeart } from "../SoulHeart"

/**
 * Sub-navigation tab: underline + SOUL heart marker on the active tab.
 * Active state is conveyed by the heart + weight + underline, not color
 * alone. Visually distinct from the app's primary (pill) navigation.
 */
export function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "flex items-center gap-1.5 border-b-2 px-4 py-2 text-small font-medium transition-colors " +
        (active
          ? "border-soul text-soul"
          : "border-transparent text-text-muted hover:text-on-void")
      }
    >
      {active && <SoulHeart className="h-2.5 w-2.5" />}
      {children}
    </button>
  )
}
