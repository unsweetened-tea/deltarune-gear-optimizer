import { useState } from "react"
import type {
  Character,
  InventoryMode,
  PresetCategory,
  PresetObjective,
  Stats,
} from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { useMarkUnavailable } from "../hooks/useMarkUnavailable"
import { optimizeParty } from "../lib/partyOptimizer"
import { toPartyObjective } from "../lib/presets"
import { STAT_TEXT_CLASS } from "../lib/statColors"
import { BossPanel } from "./BossPanel"
import { RecentlyUnavailable } from "./RecentlyUnavailable"
import { SoulHeart } from "./SoulHeart"
import { Button } from "./ui/Button"
import {
  MarkUnavailableButton,
  RemoveButton,
} from "./ui/DestructiveButtons"
import { Card } from "./ui/Card"
import { SlotRow } from "./results/SlotRow"
import { StatBlock } from "./results/StatBlock"

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

const CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: "playstyle", label: "Playstyle" },
  { id: "stat", label: "Stat" },
  { id: "boss", label: "Bosses" },
]

function objectiveLabel(objective: PresetObjective): string {
  return objective === "weightedSum" ? "Weighted sum" : "Maximin"
}

function WeightChips({ weights }: { weights: Stats }) {
  return (
    <span className="inline-flex gap-2">
      {STAT_KEYS.map((s) => (
        <span key={s} className={`${STAT_TEXT_CLASS[s]} font-mono text-mono`}>
          {s.toUpperCase()} {weights[s]}
        </span>
      ))}
    </span>
  )
}

export function OptimizeScreen() {
  const { dataset, setDataset } = useDataset()
  const [category, setCategory] = useState<PresetCategory>("playstyle")
  const [selectedByCategory, setSelectedByCategory] = useState<
    Record<PresetCategory, string | null>
  >({ playstyle: "playstyle-balanced", stat: "stat-hp", boss: null })
  /** Build-local: armor slots locked empty per member id. Reset on preset change. */
  const [locks, setLocks] = useState<Record<string, number>>({})
  const { recentlyUnavailable, markUnavailable, undoUnavailable } =
    useMarkUnavailable()

  const categoryPresets = dataset.presets.filter(
    (p) => p.category === category,
  )
  const preset =
    categoryPresets.find((p) => p.id === selectedByCategory[category]) ??
    categoryPresets[0] ??
    null

  const { chaptersEnabled, inventoryMode } = dataset.settings
  const activeParty = dataset.characters.filter((c) => c.active)

  // Apply build-local slot locks by shrinking armor capacity per member.
  const party = activeParty.map((c) => {
    const locked = locks[c.id] ?? 0
    return locked > 0
      ? {
          ...c,
          slots: { ...c.slots, armor: Math.max(0, c.slots.armor - locked) },
        }
      : c
  })

  // Auto-runs on every relevant change; the search space is tiny.
  // The boss tab has its own scoring (BossPanel) — skip the preset engine there.
  const result =
    category !== "boss" && preset && party.length > 0
      ? optimizeParty({
          party,
          items: dataset.items,
          weights: preset.weights,
          objective: toPartyObjective(preset.objective),
          chaptersEnabled,
          inventoryMode,
        })
      : null

  function selectCategory(next: PresetCategory) {
    setCategory(next)
    setLocks({})
  }

  function selectPreset(id: string) {
    setSelectedByCategory((prev) => ({ ...prev, [category]: id }))
    setLocks({})
  }

  function lockSlot(memberId: string) {
    setLocks((prev) => ({ ...prev, [memberId]: (prev[memberId] ?? 0) + 1 }))
  }

  function resetLocks(memberId: string) {
    setLocks((prev) => {
      const next = { ...prev }
      delete next[memberId]
      return next
    })
  }

  function toggleActive(id: string) {
    setDataset((prev) => ({
      ...prev,
      characters: prev.characters.map((c) =>
        c.id === id ? { ...c, active: !c.active } : c,
      ),
    }))
    setLocks({})
  }

  function toggleChapter(chapter: number) {
    setDataset((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        chaptersEnabled: prev.settings.chaptersEnabled.includes(chapter)
          ? prev.settings.chaptersEnabled.filter((c) => c !== chapter)
          : [...prev.settings.chaptersEnabled, chapter].sort((a, b) => a - b),
      },
    }))
  }

  function setInventoryMode(mode: InventoryMode) {
    setDataset((prev) => ({
      ...prev,
      settings: { ...prev.settings, inventoryMode: mode },
    }))
  }

  const datasetCharacter = (id: string): Character | undefined =>
    dataset.characters.find((c) => c.id === id)

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b border-border">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectCategory(c.id)}
            className={
              "flex items-center gap-1.5 px-4 py-2 text-small font-medium " +
              (category === c.id
                ? "border-b-2 border-soul text-soul"
                : "text-text-muted hover:text-on-void")
            }
          >
            {category === c.id && <SoulHeart className="h-2.5 w-2.5" />}
            {c.label}
          </button>
        ))}
      </nav>

      {category !== "boss" && (
        <div className="flex flex-wrap gap-2">
          {categoryPresets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPreset(p.id)}
              className={
                "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-small font-medium " +
                (preset?.id === p.id
                  ? "border-soul bg-soul text-on-soul"
                  : "border-border text-text-muted hover:border-soul hover:text-on-void")
              }
            >
              {preset?.id === p.id && <SoulHeart className="h-2.5 w-2.5" />}
              {p.label}
            </button>
          ))}
        </div>
      )}

      {category !== "boss" && preset && (
        <div className="rounded-card border border-border bg-surface p-3 text-small text-on-surface">
          <span className="font-display text-h2">{preset.label}</span>
          <span className="ml-3">
            <WeightChips weights={preset.weights} />
          </span>
          <span className="ml-3 rounded bg-surface-2 px-2 py-0.5 text-mono font-mono text-on-surface-2">
            {objectiveLabel(preset.objective)}
          </span>
          {preset.notes && (
            <p className="mt-1 text-small text-text-muted">{preset.notes}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-small">
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Party members</legend>
          <span className="text-text-muted">Party</span>
          {dataset.characters.map((c) => (
            <label key={c.id} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={c.active}
                onChange={() => toggleActive(c.id)}
              />
              {c.name}
            </label>
          ))}
        </fieldset>

        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Chapters</legend>
          <span className="text-text-muted">Chapters</span>
          {[1, 2, 3, 4, 5].map((c) => (
            <label key={c} className="flex items-center gap-1 font-mono">
              <input
                type="checkbox"
                checked={chaptersEnabled.includes(c)}
                onChange={() => toggleChapter(c)}
              />
              {c}
            </label>
          ))}
        </fieldset>

        <label className="flex items-center gap-2">
          <span className="text-text-muted">Inventory</span>
          <select
            value={inventoryMode}
            onChange={(e) => setInventoryMode(e.target.value as InventoryMode)}
            className="rounded border border-border bg-void px-2 py-1 text-on-void"
          >
            <option value="owned">Owned only</option>
            <option value="unlimited">Unlimited</option>
          </select>
        </label>
      </div>

      <RecentlyUnavailable
        entries={recentlyUnavailable}
        onUndo={undoUnavailable}
      />

      {category === "boss" ? (
        <BossPanel onMarkUnavailable={markUnavailable} />
      ) : dataset.items.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-center text-small text-text-muted">
          No items in your dataset yet. Paste gear tables in the{" "}
          <span className="font-medium text-on-surface">Import</span> tab (or
          add items by hand in{" "}
          <span className="font-medium text-on-surface">Items</span>) and
          results will appear here automatically.
        </p>
      ) : party.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-center text-small text-text-muted">
          No active party members — check at least one character above.
        </p>
      ) : !preset ? (
        <p className="rounded-card border border-border bg-surface p-6 text-center text-small text-text-muted">
          Select or create a preset to see results.
        </p>
      ) : result && !result.ok ? (
        <p className="rounded-card border border-warning/60 bg-surface p-4 text-small text-on-surface">
          <span className="font-semibold text-warning">Can’t optimize: </span>
          {result.reason}
        </p>
      ) : result?.ok ? (
        <>
          {result.assignments.length > 0 ? (
            <div className="flex items-center gap-2">
              <SoulHeart className="h-4 w-4 text-soul" />
              <h2 className="font-display text-h1 text-on-void">
                Recommended loadout
              </h2>
            </div>
          ) : (
            <h2 className="font-display text-h1 text-on-void">
              No loadouts available
            </h2>
          )}

          {result.assignments.length > 0 && (
            <p className="text-small text-text-muted">
              <span className="font-medium text-on-void">Remove</span> empties
              that slot for this build only (resets when you switch preset).{" "}
              <span className="font-medium text-warning">
                I don&apos;t have this
              </span>{" "}
              permanently sets the item&apos;s owned count to 0 in your
              dataset — undo above if misclicked.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {result.assignments.map((a) => {
              const original = datasetCharacter(a.character.id)
              const locked = locks[a.character.id] ?? 0
              const remainingSlots = (original?.slots.armor ?? 2) - locked
              const lastArmorProtected =
                original !== undefined &&
                !original.armorRemovable &&
                remainingSlots <= 1
              return (
                <Card key={a.character.id} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-h2">{a.character.name}</h3>
                    <span className="text-small text-text-muted">
                      weighted score{" "}
                      <span className="font-mono text-mono">{a.score}</span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    <SlotRow
                      slotLabel="Weapon"
                      item={a.weapon}
                      actions={
                        <>
                          <RemoveButton
                            disabled
                            disabledReason="A weapon slot can never be empty."
                          />
                          <MarkUnavailableButton
                            onClick={() => markUnavailable(a.weapon)}
                          />
                        </>
                      }
                    />
                    {a.armor.map((piece, i) => (
                      <SlotRow
                        key={i}
                        slotLabel="Armor"
                        item={piece}
                        actions={
                          <>
                            <RemoveButton
                              disabled={lastArmorProtected}
                              disabledReason={`${a.character.name} can't unequip armor (armor is not removable) — this is their last armor slot.`}
                              onClick={() => lockSlot(a.character.id)}
                            />
                            <MarkUnavailableButton
                              onClick={() => markUnavailable(piece)}
                            />
                          </>
                        }
                      />
                    ))}
                    {Array.from({ length: locked }, (_, i) => (
                      <SlotRow key={`locked-${i}`} slotLabel="Armor" />
                    ))}
                  </div>

                  {locked > 0 && (
                    <Button
                      variant="neutral"
                      size="sm"
                      onClick={() => resetLocks(a.character.id)}
                    >
                      Unlock {locked} slot(s)
                    </Button>
                  )}

                  <StatBlock totals={a.totals} />
                </Card>
              )
            })}
            {result.blocked.map((b) => (
              <Card key={b.character.id} tone="warning" className="space-y-2">
                <h3 className="font-display text-h2">{b.character.name}</h3>
                <div className="rounded border border-dashed border-warning/50 px-3 py-2">
                  <div className="text-small uppercase tracking-wide text-text-muted">
                    {b.reason.toLowerCase().includes("weapon")
                      ? "Weapon"
                      : "Armor"}
                  </div>
                  <div className="text-small text-warning">none available</div>
                </div>
                <p className="text-small text-warning">{b.reason}</p>
              </Card>
            ))}
          </div>

          {result.assignments.length > 0 && (
            <Card className="text-small">
              <span className="text-text-muted">Objective</span>{" "}
              <span className="font-medium text-on-surface">
                {preset.label}
              </span>
              <span className="mx-2 text-text-muted">·</span>
              <span className="text-text-muted">
                {objectiveLabel(preset.objective)} ·{" "}
                {inventoryMode === "owned"
                  ? "Owned pool (shared)"
                  : "Unlimited"}
              </span>
              <span className="mx-2 text-text-muted">·</span>
              <span className="font-mono text-mono font-bold text-on-surface">
                {result.objectiveScore}
              </span>
              {preset.objective === "maximin" && (
                <span className="ml-2 text-text-muted">
                  (weakest member:{" "}
                  {
                    result.assignments.reduce((min, a) =>
                      a.score < min.score ? a : min,
                    ).character.name
                  }
                  )
                </span>
              )}
            </Card>
          )}

          {inventoryMode === "owned" && (
            <div>
              <h3 className="mb-1 font-display text-h2 text-on-void">
                Leftover inventory
              </h3>
              {result.leftovers.length === 0 ? (
                <p className="text-small text-text-muted">
                  Every owned item is equipped.
                </p>
              ) : (
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
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

