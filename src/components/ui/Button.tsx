import type { ButtonHTMLAttributes, ReactNode } from "react"

export type ButtonVariant = "primary" | "secondary" | "neutral" | "warning"
export type ButtonSize = "sm" | "md"

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-soul text-on-soul hover:bg-soul/90 active:bg-soul/80",
  secondary: "border border-soul text-soul hover:bg-soul/10 active:bg-soul/20",
  neutral:
    "border border-border text-on-surface hover:bg-surface-2 active:bg-surface",
  warning:
    "border border-warning/60 text-warning hover:bg-warning/10 active:bg-warning/20",
}

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2 py-1 text-small",
  md: "px-4 py-2 text-small",
}

/**
 * Disabled uses an explicit muted treatment (not opacity) so the label
 * stays above AA contrast, and adds a dashed border + not-allowed
 * cursor so "non-interactive" reads without relying on color alone.
 */
const DISABLED =
  "cursor-not-allowed border border-dashed border-border text-text-muted"

export function Button({
  variant = "neutral",
  size = "md",
  className = "",
  type = "button",
  disabled = false,
  children,
  ...rest
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type === "submit" || type === "reset" ? type : "button"}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors ${SIZES[size]} ${disabled ? DISABLED : VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
