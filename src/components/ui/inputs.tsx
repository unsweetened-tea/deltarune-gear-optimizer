import type { InputHTMLAttributes, SelectHTMLAttributes } from "react"

const FIELD_BASE =
  "rounded border border-border bg-void text-on-void transition-colors hover:border-text-muted disabled:cursor-not-allowed disabled:border-dashed disabled:text-text-muted placeholder:text-text-muted"

export function TextInput({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      className={`${FIELD_BASE} px-2 py-1 text-body ${className}`}
      {...rest}
    />
  )
}

/**
 * Comfortable numeric field — mono figures so owned counts, weights,
 * and base stats align in a column.
 */
export function NumberInput({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      className={`${FIELD_BASE} px-2 py-1 font-mono text-mono tabular-nums ${className}`}
      {...rest}
    />
  )
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${FIELD_BASE} px-2 py-1 text-small ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
}
