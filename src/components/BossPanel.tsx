import { useState } from "react"
import type {
  Boss,
  BossSpecialRule,
  Element,
  Item,
  WinCondition,
} from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { optimizeVsBoss } from "../lib/bossOptimizer"
import { seedSpecialRulesFor } from "../lib/bossRules"
import { ELEMENT_LABELS, ELEMENTS } from "../lib/resistanceFormat"
import { slugify, uniqueSlug } from "../lib/slug"
import { SoulHeart } from "./SoulHeart"
import { MarkUnavailableButton } from "./ui/DestructiveButtons"
import { Button } from "./ui/Button"
import { Card } from "./ui/Card"
import { NumberInput, Select, TextInput } from "./ui/inputs"
import { SlotRow } from "./results/SlotRow"
import { StatBlock } from "./results/StatBlock"

const PROFILE_KEYS: (Exclude<Element, "all"> | "neutral")[] = [
  ...ELEMENTS,
  "neutral",
]

export function BossPanel({
  onMarkUnavailable,
}: {
  onMarkUnavailable: (item: Item) => void
}) {
  const { dataset, setDataset } = useDataset()
  const [selectedBossId, setSelectedBossId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newChapter, setNewChapter] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)

  const boss =
    dataset.bosses.find((b) => b.id === selectedBossId) ??
    dataset.bosses[0] ??
    null
  const party = dataset.characters.filter((c) => c.active)
  const { chaptersEnabled, inventoryMode } = dataset.settings

  const result =
    boss && party.length > 0 && dataset.items.length > 0
      ? optimizeVsBoss({
          boss,
          party,
          items: dataset.items,
          chaptersEnabled,
          inventoryMode,
        })
      : null

  function updateBoss(id: string, patch: Partial<Boss>) {
    setDataset((prev) => ({
      ...prev,
      bosses: prev.bosses.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))
  }

  function deleteBoss(id: string) {
    setDataset((prev) => ({
      ...prev,
      bosses: prev.bosses.filter((b) => b.id !== id),
    }))
  }

  function addBoss() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const id = uniqueSlug(
      `boss-${slugify(trimmed)}`,
      new Set(dataset.bosses.map((b) => b.id)),
    )
    const seededRules = seedSpecialRulesFor(trimmed)
    const created: Boss = {
      id,
      name: trimmed,
      chapter: newChapter,
      damageProfile: { neutral: 1 },
      winCondition: "fight",
      ...(seededRules.length > 0 ? { specialRules: seededRules } : {}),
    }
    setDataset((prev) => ({ ...prev, bosses: [...prev.bosses, created] }))
    setSelectedBossId(id)
    setEditorOpen(true)
    setNewName("")
  }

  const profileSum = boss
    ? PROFILE_KEYS.reduce((acc, k) => acc + (boss.damageProfile[k] ?? 0), 0)
    : 0

  return (
    <div className="space-y-6">
      <p className="text-small text-text-muted">
        A boss entry is a <span className="text-on-void">hypothesis</span>,
        not game data — nothing publishes &quot;Pink deals 70%
        Puppet/Cat&quot;. Encode your best estimate of each element&apos;s
        damage share, then refine it after a fight.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {dataset.bosses.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelectedBossId(b.id)}
            className={
              "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-small font-medium " +
              (boss?.id === b.id
                ? "border-soul bg-soul text-on-soul"
                : "border-border text-text-muted hover:border-soul hover:text-on-void")
            }
          >
            {boss?.id === b.id && <SoulHeart className="h-2.5 w-2.5" />}
            {b.name}
          </button>
        ))}

        <div className="flex items-center gap-2">
          <TextInput
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Boss name"
            className="w-36"
          />
          <label className="flex items-center gap-1 text-small text-text-muted">
            Ch.
            <NumberInput
              min={1}
              value={newChapter}
              onChange={(e) => setNewChapter(Number(e.target.value) || 1)}
              className="w-16 text-right"
            />
          </label>
          <Button
            variant="primary"
            size="sm"
            onClick={addBoss}
            disabled={!newName.trim()}
          >
            Add boss
          </Button>
        </div>
      </div>

      {!boss && (
        <p className="rounded-card border border-border bg-surface p-6 text-center text-small text-text-muted">
          No bosses yet. Add one above — you define its damage profile
          yourself; these are saved hypotheses, not combat simulations.
        </p>
      )}

      {boss && (
        <>
          <div className="rounded-card border border-border bg-surface p-3 text-small text-on-surface">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-h2">{boss.name}</span>
              <span className="font-mono text-mono text-text-muted">
                Ch. {boss.chapter}
              </span>
              <span className="rounded bg-surface-2 px-2 py-0.5 text-mono font-mono text-on-surface-2">
                {boss.winCondition}
              </span>
              {boss.winCondition !== "fight" && (
                <span className="text-text-muted">
                  ATK is irrelevant for this win condition and is ignored.
                </span>
              )}
              <span className="text-text-muted">
                {PROFILE_KEYS.filter((k) => (boss.damageProfile[k] ?? 0) > 0)
                  .map(
                    (k) =>
                      `${Math.round((boss.damageProfile[k] ?? 0) * 100)}% ${ELEMENT_LABELS[k]}`,
                  )
                  .join(" · ") || "no damage profile set"}
              </span>
              <button
                type="button"
                onClick={() => setEditorOpen((v) => !v)}
                className="ml-auto rounded border border-border px-2 py-0.5 text-small text-on-surface hover:bg-surface-2"
              >
                {editorOpen ? "Close editor" : "Edit boss"}
              </button>
            </div>
            {boss.notes && (
              <p className="mt-1 text-small text-text-muted">{boss.notes}</p>
            )}
          </div>

          {editorOpen && (
            <BossEditor
              boss={boss}
              profileSum={profileSum}
              updateBoss={updateBoss}
              deleteBoss={(id) => {
                deleteBoss(id)
                setEditorOpen(false)
              }}
            />
          )}

          {dataset.items.length === 0 ? (
            <p className="rounded-card border border-border bg-surface p-6 text-center text-small text-text-muted">
              No gear loaded yet — click{" "}
              <span className="font-medium text-on-surface">
                Reset to default data
              </span>{" "}
              above, or paste a wiki table in the{" "}
              <span className="font-medium text-on-surface">Import</span> tab,
              then come back for counter-gear.
            </p>
          ) : result && !result.ok ? (
            <p className="rounded-card border border-warning/60 bg-surface p-4 text-small text-on-surface">
              <span className="font-semibold text-warning">
                Can&apos;t optimize:{" "}
              </span>
              {result.reason}
            </p>
          ) : result?.ok ? (
            <>
              {result.assignments.length > 0 ? (
                <div className="flex items-center gap-2">
                  <SoulHeart className="h-4 w-4 text-soul" />
                  <h2 className="font-display text-h1 text-on-void">
                    Recommended counter-gear
                  </h2>
                </div>
              ) : (
                <h2 className="font-display text-h1 text-on-void">
                  No counter-gear available
                </h2>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {result.assignments.map((a) => (
                  <Card key={a.character.id} className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-display text-h2">
                        {a.character.name}
                      </h3>
                      <span
                        className="text-small text-text-muted"
                        title="Elemental damage multiplier incl. special rules — 1.00 means unresisted"
                      >
                        ×
                        <span className="font-mono text-mono font-bold text-on-surface">
                          {a.damageMultiplier.toFixed(2)}
                        </span>{" "}
                        dmg
                      </span>
                    </div>
                    <p className="text-small text-text-muted">
                      ~{Math.round(a.perHit)} taken per nominal 100 hit
                    </p>

                    <div className="space-y-2">
                      <SlotRow
                        slotLabel="Weapon"
                        item={a.weapon}
                        actions={
                          <MarkUnavailableButton
                            onClick={() => onMarkUnavailable(a.weapon)}
                          />
                        }
                      />
                      {a.armor.map((piece, i) => (
                        <SlotRow
                          key={i}
                          slotLabel="Armor"
                          item={piece}
                          note={
                            a.why.find((w) => w.itemName === piece.name)?.text
                          }
                          actions={
                            <MarkUnavailableButton
                              onClick={() => onMarkUnavailable(piece)}
                            />
                          }
                        />
                      ))}
                      {a.armor.length === 0 && <SlotRow slotLabel="Armor" />}
                    </div>

                    <StatBlock totals={a.totals} />
                  </Card>
                ))}
                {result.blocked.map((b) => (
                  <Card key={b.character.id} tone="warning" className="space-y-2">
                    <h3 className="font-display text-h2">{b.character.name}</h3>
                    <div className="rounded border border-dashed border-warning/50 px-3 py-2">
                      <div className="text-small uppercase tracking-wide text-text-muted">
                        {b.reason.toLowerCase().includes("weapon")
                          ? "Weapon"
                          : "Armor"}
                      </div>
                      <div className="text-small text-warning">
                        none available
                      </div>
                    </div>
                    <p className="text-small text-warning">{b.reason}</p>
                  </Card>
                ))}
              </div>

              <div>
                <h3 className="font-display text-h2 text-on-void">
                  Items considered
                </h3>
                <p className="mb-2 text-small text-text-muted">
                  Why each candidate was picked or passed over — the rejected
                  ones are often the real insight.
                </p>
                <Card padded={false} className="divide-y divide-border">
                  {[...result.verdicts]
                    .sort(
                      (a, b) =>
                        Number(b.used) - Number(a.used) ||
                        a.item.name.localeCompare(b.item.name),
                    )
                    .map((v) => (
                      <div key={v.item.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-on-surface">
                            {v.item.name}
                          </span>
                          {v.used ? (
                            <span className="shrink-0 rounded bg-surface-2 px-2 py-0.5 text-small text-success">
                              picked · {v.usedBy}
                            </span>
                          ) : (
                            <span className="shrink-0 rounded bg-surface-2 px-2 py-0.5 text-small text-text-muted">
                              rejected
                            </span>
                          )}
                        </div>
                        {v.reasons.length > 0 && (
                          <p className="mt-1 text-small text-on-surface">
                            {v.reasons.join("; ")}
                          </p>
                        )}
                      </div>
                    ))}
                </Card>
              </div>

              {inventoryMode === "owned" && result.leftovers.length > 0 && (
                <div>
                  <h3 className="mb-1 font-display text-h2 text-on-void">
                    Leftover inventory
                  </h3>
                  <ul className="text-small text-on-void">
                    {result.leftovers.map(({ item, unused }) => (
                      <li key={item.id}>
                        {item.name}{" "}
                        <span className="font-mono text-mono text-text-muted">
                          × {unused}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  )
}

function BossEditor({
  boss,
  profileSum,
  updateBoss,
  deleteBoss,
}: {
  boss: Boss
  profileSum: number
  updateBoss: (id: string, patch: Partial<Boss>) => void
  deleteBoss: (id: string) => void
}) {
  const { dataset } = useDataset()

  function updateRule(index: number, patch: Partial<BossSpecialRule>) {
    const rules = (boss.specialRules ?? []).map((r, i) =>
      i === index ? { ...r, ...patch } : r,
    )
    updateBoss(boss.id, { specialRules: rules })
  }

  function addRule() {
    updateBoss(boss.id, {
      specialRules: [
        ...(boss.specialRules ?? []),
        { itemName: "", flatReduction: 0.5 },
      ],
    })
  }

  function removeRule(index: number) {
    const rules = (boss.specialRules ?? []).filter((_, i) => i !== index)
    updateBoss(boss.id, {
      specialRules: rules.length > 0 ? rules : undefined,
    })
  }

  const profileOff = Math.abs(profileSum - 1) > 0.05

  return (
    <div className="space-y-4 rounded-card border border-dashed border-border p-4 text-small text-on-void">
      {/* Identity */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-text-muted">
          Name
          <TextInput
            value={boss.name}
            onChange={(e) => updateBoss(boss.id, { name: e.target.value })}
            className="w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-text-muted">
          Chapter
          <NumberInput
            min={1}
            value={boss.chapter}
            onChange={(e) =>
              updateBoss(boss.id, { chapter: Number(e.target.value) || 1 })
            }
            className="w-16 text-right"
          />
        </label>
        <label className="flex flex-col gap-1 text-text-muted">
          Win by
          <Select
            value={boss.winCondition}
            onChange={(e) =>
              updateBoss(boss.id, {
                winCondition: e.target.value as WinCondition,
              })
            }
          >
            <option value="fight">fight</option>
            <option value="spare">spare</option>
            <option value="special">special</option>
          </Select>
        </label>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => deleteBoss(boss.id)}
          className="ml-auto"
        >
          Delete boss
        </Button>
      </div>

      {/* Damage profile — shares should sum to ~1 */}
      <fieldset>
        <legend className="mb-1.5 flex items-center gap-2 font-medium text-text-muted">
          Damage shares
          <span className="font-normal">— should sum to ~1.00</span>
          <span
            className={`rounded px-2 py-0.5 font-mono ${
              profileOff
                ? "bg-warning/10 text-warning"
                : "bg-surface-2 text-on-surface-2"
            }`}
          >
            Σ {profileSum.toFixed(2)}
            {profileOff ? " ⚠" : " ✓"}
          </span>
        </legend>
        <div className="flex flex-wrap gap-3">
          {PROFILE_KEYS.map((key) => (
            <label key={key} className="flex flex-col gap-1 text-text-muted">
              {ELEMENT_LABELS[key]}
              <NumberInput
                step={0.05}
                min={0}
                max={1}
                value={boss.damageProfile[key] ?? 0}
                onChange={(e) =>
                  updateBoss(boss.id, {
                    damageProfile: {
                      ...boss.damageProfile,
                      [key]: e.target.value === "" ? 0 : Number(e.target.value),
                    },
                  })
                }
                className="w-20 text-right"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {/* Special rules */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-muted">
            Special rules (attacks that bypass elements)
          </span>
          <Button variant="neutral" size="sm" onClick={addRule}>
            Add rule
          </Button>
        </div>
        {(boss.specialRules ?? []).map((rule, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <TextInput
              value={rule.itemName}
              onChange={(e) => updateRule(i, { itemName: e.target.value })}
              placeholder="Item name (e.g. Shadow Mantle)"
              className="w-52"
            />
            <Select
              value={rule.requiredCharacterId ?? ""}
              onChange={(e) =>
                updateRule(i, {
                  requiredCharacterId: e.target.value || undefined,
                })
              }
            >
              <option value="">any character</option>
              {dataset.characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} only
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-1 text-text-muted">
              cuts damage
              <NumberInput
                min={0}
                max={100}
                value={Math.round(rule.flatReduction * 100)}
                onChange={(e) =>
                  updateRule(i, {
                    flatReduction:
                      Math.min(100, Math.max(0, Number(e.target.value) || 0)) /
                      100,
                  })
                }
                className="w-16 text-right"
              />
              %
            </label>
            <Button variant="secondary" size="sm" onClick={() => removeRule(i)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-text-muted">
        Notes
        <TextInput
          value={boss.notes ?? ""}
          onChange={(e) =>
            updateBoss(boss.id, { notes: e.target.value || undefined })
          }
          placeholder="What does this fight actually do?"
          className="w-full"
        />
      </label>
    </div>
  )
}
