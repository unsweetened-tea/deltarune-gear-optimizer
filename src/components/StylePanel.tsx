import { STAT_TEXT_CLASS } from "../lib/statColors"
import { SoulHeart } from "./SoulHeart"
import { Button } from "./ui/Button"
import { Card } from "./ui/Card"
import { Checkbox } from "./ui/Checkbox"
import { NumberInput, Select, TextInput } from "./ui/inputs"
import { Badge, StatBadge } from "./ui/Badge"
import { Tooltip } from "./ui/Tooltip"
import {
  MarkUnavailableButton,
  RemoveButton,
} from "./ui/DestructiveButtons"

/**
 * Dev-only style reference. Renders every token and every shared
 * primitive in every state, so any contrast or state regression is
 * visible here before it ships. Keep current through the design pass.
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

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-h1 text-on-void">{title}</h2>
      {children}
    </section>
  )
}

export function StylePanel() {
  return (
    <div className="space-y-8">
      <Section title="Surfaces × paired foregrounds">
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
      </Section>

      <Section title="Type scale">
        <Card>
          <div className="space-y-2">
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
        </Card>
      </Section>

      <Section title="Buttons — variants & states">
        <Card>
          <div className="space-y-4">
            {(["primary", "secondary", "neutral", "warning"] as const).map(
              (variant) => (
                <div key={variant} className="flex flex-wrap items-center gap-3">
                  <span className="w-20 text-small text-text-muted">
                    {variant}
                  </span>
                  <Button variant={variant}>Default</Button>
                  <Button variant={variant} className="hover:bg-soul/90">
                    Hover me
                  </Button>
                  <Button variant={variant} disabled>
                    Disabled
                  </Button>
                  <Button variant={variant} size="sm">
                    Small
                  </Button>
                </div>
              ),
            )}
            <p className="text-small text-text-muted">
              Disabled uses muted text (AA-safe) + a dashed border +
              not-allowed cursor — never opacity alone. Tab through to see the
              focus ring.
            </p>
          </div>
        </Card>
      </Section>

      <Section title="The two destructive actions (never confuse them)">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-small text-text-muted">
                <span className="font-semibold text-on-surface">Remove</span> —
                temporary, build-scoped, reversible. Light ghost, low weight.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <RemoveButton onClick={() => {}} />
                <RemoveButton
                  disabled
                  disabledReason="A weapon slot can never be empty."
                />
              </div>
              <p className="text-small text-text-muted">
                Disabled example carries a keyboard-reachable tooltip (focus
                it).
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-small text-text-muted">
                <span className="font-semibold text-warning">
                  I don&apos;t have this
                </span>{" "}
                — permanent, dataset-scoped (writes owned:0). Heavier: warning
                fill + bold + slash icon.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <MarkUnavailableButton onClick={() => {}} />
              </div>
              <p className="text-small text-text-muted">
                Side by side, the second should read as the one to click
                carefully.
              </p>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Inputs">
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-small text-text-muted">
              Text
              <TextInput placeholder="Item name" />
            </label>
            <label className="flex flex-col gap-1 text-small text-text-muted">
              Number (mono)
              <NumberInput defaultValue={1} className="w-20" />
            </label>
            <label className="flex flex-col gap-1 text-small text-text-muted">
              Select
              <Select defaultValue="owned">
                <option value="owned">Owned only</option>
                <option value="unlimited">Unlimited</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-small text-text-muted">
              Disabled
              <TextInput placeholder="Disabled" disabled />
            </label>
            <div className="flex flex-col gap-2">
              <Checkbox label="Unchecked" />
              <Checkbox label="Checked" defaultChecked />
              <Checkbox label="Disabled" disabled />
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Tabs, badges & tooltips">
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>chip</Badge>
              {STAT_KEYS.map((stat) => (
                <StatBadge
                  key={stat}
                  stat={stat}
                  value={stat === "atk" ? -6 : 17}
                />
              ))}
            </div>
            <div className="flex items-center gap-4">
              <Tooltip label="Tooltips appear on hover and keyboard focus.">
                <Button variant="neutral" size="sm">
                  Hover or focus me
                </Button>
              </Tooltip>
              <span className="text-small text-text-muted">
                Reachable without a mouse.
              </span>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Stat color language">
        <div className="flex flex-wrap gap-3">
          {STAT_KEYS.map((stat) => (
            <Card key={stat} className="px-4 py-3 text-center">
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
            </Card>
          ))}
        </div>
        <p className="mt-2 text-small text-text-muted">
          HP green · ATK orange · DEF blue · Magic purple — everywhere,
          always. Never collapsed into one accent.
        </p>
      </Section>

      <Section title="SOUL heart (selection marker)">
        <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 text-soul">
          <SoulHeart className="h-2.5 w-2.5" />
          <SoulHeart className="h-4 w-4" />
          <SoulHeart className="h-6 w-6" />
          <SoulHeart className="h-10 w-10" />
          <span className="text-small text-text-muted">
            One role only: marks the active selection.
          </span>
        </div>
      </Section>

      <Section title="Cards & messages">
        <div className="space-y-3">
          <Card tone="accent">
            <p className="text-small">
              Accent card (soul-tinted border) — used to frame a result.
            </p>
          </Card>
          <Card tone="warning">
            <p className="text-small">
              <span className="font-semibold text-warning">Warning: </span>
              something needs attention but nothing is broken.
            </p>
          </Card>
          <p className="text-small text-success">
            Success message — committed 12 item(s).
          </p>
        </div>
      </Section>
    </div>
  )
}
