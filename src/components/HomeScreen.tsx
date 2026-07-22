import type { ReactNode } from "react"
import type { PresetCategory } from "../types/data"
import type { Tab } from "../lib/routes"
import { Button } from "./ui/Button"
import type { ButtonVariant } from "./ui/Button"

const STEPS = [
  "Load your gear",
  "Pick a goal",
  "Get the optimal loadout",
]

/**
 * A launcher built from the D2 Button — the only additions are full width and
 * a stacked label/description. Padding is added *inside* the button rather
 * than overriding the variant's own padding, so nothing fights the primitive.
 */
function LaunchButton({
  variant,
  label,
  description,
  onClick,
}: {
  variant: ButtonVariant
  label: string
  description: ReactNode
  onClick: () => void
}) {
  return (
    <Button variant={variant} onClick={onClick} className="w-full">
      <span className="flex w-full flex-col gap-0.5 py-1 text-left">
        <span className="font-display text-h2">{label}</span>
        <span className="text-small font-normal">{description}</span>
      </span>
    </Button>
  )
}

/**
 * The front door. Deliberately impersonal: it renders identically for every
 * visitor, with no saved-state readout. The one exception is the empty-store
 * safety net, which sits *below* the launch buttons so the buttons stay
 * above the fold on a laptop and at 360px.
 */
export function HomeScreen({
  onNavigate,
  storeIsEmpty,
  onReset,
  onImport,
}: {
  onNavigate: (tab: Tab, optimizeCategory?: PresetCategory) => void
  storeIsEmpty: boolean
  onReset: () => void
  onImport: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-h1 text-on-void sm:text-display">
          Deltarune Gear Optimizer
        </h1>
        <p className="text-body text-on-void">
          Find the best gear loadout for your Deltarune party.
        </p>
        {/* Compresses first when vertical space is tight — the launch
            buttons below must never be pushed off-screen. */}
        <ol className="flex flex-col gap-1 text-small text-text-muted sm:flex-row sm:flex-wrap sm:gap-x-5 [@media(max-height:600px)]:hidden">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded bg-surface-2 px-1.5 font-mono text-mono text-on-surface-2">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-col gap-3">
        <LaunchButton
          variant="primary"
          label="Optimize my party"
          description="Best loadout across the whole party, from the gear you own."
          onClick={() => onNavigate("optimize")}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <LaunchButton
            variant="secondary"
            label="Counter a boss"
            description="Gear that survives a specific boss's damage."
            onClick={() => onNavigate("optimize", "boss")}
          />
          <LaunchButton
            variant="secondary"
            label="Manage gear"
            description="Edit the gear table and mark what you own."
            onClick={() => onNavigate("items")}
          />
        </div>

        <LaunchButton
          variant="neutral"
          label="How it works"
          description="The three steps in full, and where your data lives."
          onClick={() => onNavigate("about")}
        />
      </div>

      {storeIsEmpty && (
        <p className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3 text-small text-on-surface">
          <span>
            No gear is loaded. Load the bundled default data, or import a JSON
            backup.
          </span>
          <Button variant="warning" size="sm" onClick={onReset}>
            Reset to default data
          </Button>
          <Button variant="secondary" size="sm" onClick={onImport}>
            Import JSON
          </Button>
        </p>
      )}
    </div>
  )
}
