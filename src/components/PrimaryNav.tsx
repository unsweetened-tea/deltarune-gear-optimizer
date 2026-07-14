import { useEffect, useState } from "react"

export interface NavSection {
  id: string
  label: string
}

/**
 * App-level primary navigation. Desktop: an inline segmented row.
 * Mobile: a hamburger that opens a drawer below the top bar. The
 * active section is conveyed by a filled surface pill + bolder weight
 * (not color alone) and aria-current, distinct from the underline +
 * heart treatment used by the nested Optimize sub-tabs.
 */
export function PrimaryNav({
  sections,
  activeId,
  onSelect,
}: {
  sections: NavSection[]
  activeId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const itemClass = (active: boolean) =>
    "rounded px-3 py-2 text-small transition-colors " +
    (active
      ? "bg-surface font-semibold text-on-surface"
      : "font-medium text-text-muted hover:bg-surface/60 hover:text-on-void")

  function select(id: string) {
    onSelect(id)
    setOpen(false)
  }

  const items = (stacked: boolean) =>
    sections.map((s) => (
      <button
        key={s.id}
        type="button"
        onClick={() => select(s.id)}
        aria-current={s.id === activeId ? "page" : undefined}
        className={itemClass(s.id === activeId) + (stacked ? " text-left" : "")}
      >
        {s.label}
      </button>
    ))

  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden items-center gap-1 md:flex"
      >
        {items(false)}
      </nav>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="primary-nav-drawer"
        aria-label="Toggle navigation menu"
        className="rounded border border-border p-2 text-on-void hover:bg-surface md:hidden"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M5 5l10 10M15 5L5 15" />
          ) : (
            <path d="M3 6h14M3 10h14M3 14h14" />
          )}
        </svg>
      </button>

      {open && (
        <nav
          id="primary-nav-drawer"
          aria-label="Primary"
          className="absolute inset-x-0 top-full z-20 flex flex-col gap-1 border-b border-border bg-void p-3 text-on-void md:hidden"
        >
          {items(true)}
        </nav>
      )}
    </>
  )
}
