import type { PresetCategory } from "../types/data"
import type { Tab } from "../lib/routes"
import { Button } from "./ui/Button"
import { Card } from "./ui/Card"

const STEPS = [
  {
    title: "Load your gear",
    body: "The app ships with the wiki's gear table already loaded. Edit it, paste your own table in Import, or mark the owned count of anything you don't have yet.",
  },
  {
    title: "Pick a goal",
    body: "A playstyle (balanced, aggressive, defensive, support), a single stat to max out, or a boss to counter. Each goal is just a set of weights over HP, ATK, DEF and Magic.",
  },
  {
    title: "Get the optimal loadout",
    body: "The optimizer searches every legal assignment of your owned gear across the active party — no duplicates, slot rules respected — and shows the best one, plus the runners-up.",
  },
]

export function AboutScreen({
  onNavigate,
}: {
  onNavigate: (tab: Tab, optimizeCategory?: PresetCategory) => void
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-body text-on-void">
        A gear calculator for Deltarune: it works out which loadout makes your
        party strongest with the items you actually own.
      </p>

      <ol className="flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <Card>
              <h2 className="flex items-center gap-2 font-display text-h2 text-on-surface">
                <span className="rounded bg-surface-2 px-1.5 font-mono text-mono text-on-surface-2">
                  {i + 1}
                </span>
                {step.title}
              </h2>
              <p className="mt-1 text-small text-on-surface">{step.body}</p>
            </Card>
          </li>
        ))}
      </ol>

      <Card>
        <h2 className="font-display text-h2 text-on-surface">
          Where your data lives
        </h2>
        <p className="mt-1 text-small text-on-surface">
          There is no account and no server. Your gear table, owned counts and
          presets are saved in this browser only. Use{" "}
          <span className="font-medium">Export JSON</span> to back them up or
          move them to another browser, and{" "}
          <span className="font-medium">Reset to default data</span> to start
          over from the bundled table.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => onNavigate("optimize")}>
          Optimize my party
        </Button>
        <Button variant="neutral" onClick={() => onNavigate("home")}>
          Back to Home
        </Button>
      </div>
    </div>
  )
}
