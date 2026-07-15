import type { InputHTMLAttributes, ReactNode } from "react"

/**
 * Checkbox with an accent-soul check so selected reads on-brand.
 * When `label` is given it wraps in a clickable label; otherwise it's
 * a bare box (for table cells) still carrying an accessible name.
 */
export function Checkbox({
  label,
  className = "",
  ...rest
}: {
  label?: ReactNode
} & InputHTMLAttributes<HTMLInputElement>) {
  const box = (
    <input
      type="checkbox"
      className={`h-4 w-4 shrink-0 accent-soul disabled:cursor-not-allowed ${className}`}
      {...rest}
    />
  )
  if (label === undefined) return box
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-small text-on-surface">
      {box}
      {label}
    </label>
  )
}
