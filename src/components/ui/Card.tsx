import type { HTMLAttributes, ReactNode } from "react"

export type CardTone = "surface" | "accent" | "warning"

const TONES: Record<CardTone, string> = {
  surface: "border-border bg-surface text-on-surface",
  accent: "border-soul/40 bg-surface text-on-surface",
  warning: "border-warning/60 bg-surface text-on-surface",
}

export function Card({
  tone = "surface",
  padded = true,
  className = "",
  children,
  ...rest
}: {
  tone?: CardTone
  /** Set false for zero-padding cards that host their own divided rows. */
  padded?: boolean
  children: ReactNode
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`overflow-hidden rounded-card border ${padded ? "p-4" : ""} ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
