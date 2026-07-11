import { STAT_TEXT_CLASS } from "../lib/statColors"
import { SoulHeart } from "./SoulHeart"

/**
 * Dev-only style reference. Renders every token with its paired
 * foreground so any contrast regression is instantly visible here
 * before it ships anywhere else. Keep through the whole design pass.
 */

const SURFACES = [
  { bg: "bg-void", fg: "text-on-void", label: "void / on-void" },
  { bg: "bg-surface", fg: "text-on-surface", label: "surface / on-surface" },
  {
    bg: "bg-surface-2",
    fg: "text-on-surface-2",
    label: "surface-2 / on-surface-2",
  },
  { bg: "bg-soul", fg: "text-on-soul", label: "soul / on-soul" },
  { bg: "bg-warning", fg: "text-on-warning", label: "warning / on-warning" },
] as const

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

export function StylePanel() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-h1 text-on-void">
          Surfaces × paired foregrounds
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {SURFACES.map(({ bg, fg, label }) => (
            <div
              key={label}
              className={`rounded-card border border-border p-4 ${bg} ${fg}`}
            >
              <p className="font-medium">{label}</p>
              <p className="text-small">
                Body text on this surface. Never set a background without its
                paired on- color.
              </p>
              {bg !== "bg-soul" && bg !== "bg-warning" && (
                <p className="text-small text-text-muted">
                  Muted secondary text (text-text-muted).
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-h1 text-on-void">Type scale</h2>
        <div className="space-y-2 rounded-card border border-border bg-surface p-4 text-on-surface">
          <p className="font-display text-display">
            Display — Bricolage Grotesque
          </p>
          <p className="font-display text-h1">H1 — Bricolage Grotesque</p>
          <p className="font-display text-h2">H2 — Bricolage Grotesque</p>
          <p className="text-body">
            Body — Hanken Grotesk. The quick darkner jumps over the lazy
            lightner.
          </p>
          <p className="text-small text-text-muted">
            Small — Hanken Grotesk, muted.
          </p>
          <p className="font-mono text-mono">
            Mono — JetBrains Mono: 0123456789 +2 −6 ×4
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-h1 text-on-void">
          Stat color language
        </h2>
        <div className="flex flex-wrap gap-3">
          {STAT_KEYS.map((stat) => (
            <div
              key={stat}
              className="rounded-card border border-border bg-surface px-4 py-3 text-center text-on-surface"
            >
              <div
                className={`text-small font-medium uppercase ${STAT_TEXT_CLASS[stat]}`}
              >
                {stat}
              </div>
              <div
                className={`font-mono text-h1 font-bold ${STAT_TEXT_CLASS[stat]}`}
              >
                {stat === "hp" ? 42 : stat === "atk" ? -6 : 17}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-small text-text-muted">
          HP green · ATK orange · DEF blue · Magic purple — everywhere,
          always. Never collapsed into one accent.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-h1 text-on-void">Controls</h2>
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4 text-on-surface">
          <button
            type="button"
            className="rounded bg-soul px-4 py-2 text-small font-medium text-on-soul hover:bg-soul/90"
          >
            Primary action
          </button>
          <button
            type="button"
            className="rounded border border-soul px-4 py-2 text-small font-medium text-soul hover:bg-soul/10"
          >
            Accent outline
          </button>
          <button
            type="button"
            className="rounded border border-border px-4 py-2 text-small text-on-surface hover:bg-surface-2"
          >
            Neutral
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded border border-border px-4 py-2 text-small text-text-muted opacity-40"
          >
            Disabled
          </button>
          <input
            placeholder="Text input"
            className="rounded border border-border bg-void px-2 py-1.5 text-small text-on-void placeholder:text-text-muted"
          />
          <select className="rounded border border-border bg-void px-2 py-1.5 text-small text-on-void">
            <option>Select</option>
          </select>
        </div>
        <p className="mt-2 text-small text-text-muted">
          Tab to any control to see the focus ring token.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-h1 text-on-void">
          SOUL heart (selection marker)
        </h2>
        <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 text-soul">
          <SoulHeart className="h-2.5 w-2.5" />
          <SoulHeart className="h-4 w-4" />
          <SoulHeart className="h-6 w-6" />
          <SoulHeart className="h-10 w-10" />
          <span className="text-small text-text-muted">
            One role only: marks the active selection.
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-h1 text-on-void">Messages</h2>
        <div className="space-y-3">
          <p className="rounded-card border border-warning/60 bg-surface p-3 text-small text-on-surface">
            <span className="font-semibold text-warning">Warning: </span>
            something needs your attention but nothing is broken.
          </p>
          <p className="text-small text-success">
            Success message — committed 12 item(s).
          </p>
        </div>
      </section>
    </div>
  )
}
