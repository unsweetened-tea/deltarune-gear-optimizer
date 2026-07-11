/**
 * The SOUL heart — the app's single iconic selection marker.
 * Fills with currentColor so it inherits text-soul (or any token color)
 * from its context. Keep its role to marking the active selection.
 */
export function SoulHeart({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`inline-block shrink-0 fill-current ${className}`}
    >
      <path d="M8 14C8 14 1.5 9.6 1.5 5.6 1.5 3.2 3.3 1.6 5.3 1.6c1.1 0 2.1.5 2.7 1.4.6-.9 1.6-1.4 2.7-1.4 2 0 3.8 1.6 3.8 4 0 4-6.5 8.4-6.5 8.4Z" />
    </svg>
  )
}
