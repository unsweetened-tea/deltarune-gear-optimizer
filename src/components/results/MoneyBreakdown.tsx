import type { MoneySettings } from "../../types/data"
import type { MoneyBreakdown } from "../../lib/money"
import { Card } from "../ui/Card"

function signed(pct: number): string {
  return pct > 0 ? `+${pct}%` : `${pct}%`
}

/**
 * The money result: the headline bonus, the assumption that produced it
 * (stated plainly so it reads as changeable, not a verified rule), which
 * items contributed, and any penalty item the guardrail could not avoid.
 */
export function MoneyBreakdownCard({
  breakdown,
}: {
  breakdown: MoneyBreakdown
}) {
  const { totalPercent, contributions, forcedNegatives, assumptionText } =
    breakdown
  const positive = totalPercent >= 0
  return (
    <Card tone="accent" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-h2 text-on-surface">
          Dark Dollars earned
        </h3>
        <span
          className={`font-mono text-h1 font-bold tabular-nums ${
            positive ? "text-success" : "text-warning"
          }`}
        >
          {signed(totalPercent)}
        </span>
      </div>

      <p className="text-small text-text-muted">
        {assumptionText} This is an assumption you can change above — the real
        in-game stacking rule is unverified.
      </p>

      {contributions.length > 0 ? (
        <ul className="space-y-1 text-small text-on-surface">
          {contributions.map((c) => (
            <li key={`${c.characterId}:${c.itemId}`} className="flex gap-2">
              <span
                className={`font-mono tabular-nums ${
                  c.percent >= 0 ? "text-success" : "text-warning"
                }`}
              >
                {signed(c.percent)}
              </span>
              <span>
                {c.itemName}{" "}
                <span className="text-text-muted">on {c.characterName}</span>
                {c.forced && (
                  <span className="text-warning"> (forced — see below)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-text-muted">
          No money gear is equipped in this build.
        </p>
      )}

      {forcedNegatives.length > 0 && (
        <p className="rounded border border-warning/60 bg-surface-2 p-2 text-small text-on-surface-2">
          <span className="font-semibold text-warning">Unavoidable penalty:</span>{" "}
          {forcedNegatives
            .map((c) => `${c.itemName} (${signed(c.percent)}) on ${c.characterName}`)
            .join(", ")}{" "}
          — equipped only because that slot had no other legal option.
        </p>
      )}
    </Card>
  )
}

const selectClass =
  "rounded border border-border bg-void px-2 py-1 text-small text-on-void"

/**
 * The two money assumptions, editable inline. Persisted by the caller so
 * the choice sticks and travels through export/import.
 */
export function MoneySettingsControls({
  settings,
  onChange,
}: {
  settings: MoneySettings
  onChange: (next: MoneySettings) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-small">
      <label className="flex items-center gap-2">
        <span className="text-text-muted">Stacking</span>
        <select
          value={settings.stackMode}
          onChange={(e) =>
            onChange({
              ...settings,
              stackMode: e.target.value as MoneySettings["stackMode"],
            })
          }
          className={selectClass}
        >
          <option value="additive">Additive (percents add)</option>
          <option value="multiplicative">Multiplicative (compound)</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-text-muted">Scope</span>
        <select
          value={settings.scope}
          onChange={(e) =>
            onChange({
              ...settings,
              scope: e.target.value as MoneySettings["scope"],
            })
          }
          className={selectClass}
        >
          <option value="party-wide">Party-wide (all items count)</option>
          <option value="wearer-only">Wearer-only (best per character)</option>
        </select>
      </label>
    </div>
  )
}
