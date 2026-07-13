import { useState } from "react"
import type {
  Character,
  InventoryMode,
  Item,
  PresetCategory,
  PresetObjective,
  Stats,
} from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { optimizeParty } from "../lib/partyOptimizer"
import { toPartyObjective } from "../lib/presets"
import { STAT_TEXT_CLASS } from "../lib/statColors"
import { BossPanel } from "./BossPanel"
import { SoulHeart } from "./SoulHeart"

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

const CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: "playstyle", label: "Playstyle" },
  { id: "stat", label: "Stat" },
  { id: "boss", label: "Bosses" },
]

interface UnavailableEntry {
  itemId: string
  itemName: string
  previousOwned: number
}

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
  const [recentlyUnavailable, setRecentlyUnavailable] = useState<
    UnavailableEntry[]
  >([])

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

  function markUnavailable(item: Item) {
    if (item.owned <= 0) return
    setRecentlyUnavailable((prev) => [
      { itemId: item.id, itemName: item.name, previousOwned: item.owned },
      ...prev,
    ])
    setDataset((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === item.id ? { ...it, owned: 0 } : it,
      ),
    }))
  }

  function undoUnavailable(entry: UnavailableEntry) {
    setDataset((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === entry.itemId ? { ...it, owned: entry.previousOwned } : it,
      ),
    }))
    setRecentlyUnavailable((prev) => prev.filter((e) => e !== entry))
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

      {recentlyUnavailable.length > 0 && (
        <div className="rounded-card border border-border bg-surface-2 p-3 text-small text-on-surface-2">
          <h3 className="text-small font-semibold text-text-muted uppercase">
            Recently marked unavailable (owned set to 0)
          </h3>
          <ul className="mt-1 space-y-1">
            {recentlyUnavailable.map((entry, i) => (
              <li key={i} className="flex items-center gap-2">
                <span>{entry.itemName}</span>
                <button
                  type="button"
                  onClick={() => undoUnavailable(entry)}
                  className="rounded border border-border px-2 py-0.5 text-small text-on-surface-2 hover:border-soul hover:text-soul"
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
          {result.assignments.length > 0 && (
            <div className="rounded-card border border-soul/40 bg-surface p-4 text-small text-on-surface">
              <span className="font-display text-h2 text-soul">
                {preset.label}
              </span>
              <span className="ml-3 text-text-muted">
                {objectiveLabel(preset.objective)} ·{" "}
                {inventoryMode === "owned"
                  ? "Owned pool (shared)"
                  : "Unlimited"}
              </span>
              <span className="ml-3 font-mono text-h2 font-bold">
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
            </div>
          )}

          <p className="text-small text-text-muted">
            <span className="font-medium text-on-void">Remove</span> empties
            that slot for this build only (resets when you switch preset).{" "}
            <span className="font-medium text-on-void">
              I don&apos;t have this
            </span>{" "}
            permanently sets the item&apos;s owned count to 0 in your dataset
            — undo above if misclicked.
          </p>

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
                <div
                  key={a.character.id}
                  className="rounded-card border border-border bg-surface p-4 text-on-surface"
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-h2">
                      {a.character.name}
                    </h3>
                    <span className="text-small text-text-muted">
                      weighted score{" "}
                      <span className="font-mono text-mono">{a.score}</span>
                    </span>
                  </div>

                  <ul className="mt-2 space-y-1 text-small">
                    <li className="flex items-center gap-2">
                      <span>
                        <span className="text-text-muted">Weapon:</span>{" "}
                        {a.weapon.name}
                      </span>
                      <button
                        type="button"
                        disabled
                        title="A weapon slot can never be empty."
                        className="cursor-not-allowed rounded border border-border px-2 py-0.5 text-small text-text-muted opacity-40"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => markUnavailable(a.weapon)}
                        className="rounded border border-soul/60 px-2 py-0.5 text-small text-soul hover:bg-soul/10"
                      >
                        I don&apos;t have this
                      </button>
                    </li>
                    {a.armor.map((piece, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span>
                          <span className="text-text-muted">Armor:</span>{" "}
                          {piece.name}
                        </span>
                        <button
                          type="button"
                          disabled={lastArmorProtected}
                          title={
                            lastArmorProtected
                              ? `${a.character.name} can't unequip armor (armor is not removable) — this is their last armor slot.`
                              : "Lock this slot empty for this build and re-optimize."
                          }
                          onClick={() => lockSlot(a.character.id)}
                          className={
                            lastArmorProtected
                              ? "cursor-not-allowed rounded border border-border px-2 py-0.5 text-small text-text-muted opacity-40"
                              : "rounded border border-border px-2 py-0.5 text-small text-on-surface hover:bg-surface-2"
                          }
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => markUnavailable(piece)}
                          className="rounded border border-soul/60 px-2 py-0.5 text-small text-soul hover:bg-soul/10"
                        >
                          I don&apos;t have this
                        </button>
                      </li>
                    ))}
                    {Array.from({ length: locked }, (_, i) => (
                      <li key={`locked-${i}`} className="text-text-muted">
                        <span>Armor:</span> (locked empty)
                      </li>
                    ))}
                  </ul>

                  {locked > 0 && (
                    <button
                      type="button"
                      onClick={() => resetLocks(a.character.id)}
                      className="mt-2 rounded border border-border px-2 py-0.5 text-small text-on-surface hover:bg-surface-2"
                    >
                      Unlock {locked} slot(s)
                    </button>
                  )}

                  <div className="mt-3 flex gap-2">
                    {STAT_KEYS.map((stat) => (
                      <div
                        key={stat}
                        className="rounded bg-surface-2 px-2 py-1 text-center text-on-surface-2"
                      >
                        <div
                          className={`text-small font-medium uppercase ${STAT_TEXT_CLASS[stat]}`}
                        >
                          {stat}
                        </div>
                        <div
                          className={`font-mono text-mono font-bold ${STAT_TEXT_CLASS[stat]}`}
                        >
                          {a.totals[stat]}
                        </div>
                      </div>
                    ))}
                  </div>

                  {[a.weapon, ...a.armor].some((it) => it.ability) && (
                    <ul className="mt-3 space-y-1 rounded-card border border-warning/60 bg-surface-2 p-2 text-small text-on-surface-2">
                      {[a.weapon, ...a.armor]
                        .filter((it) => it.ability)
                        .map((it, i) => (
                          <li key={i}>
                            <span className="font-medium text-warning">
                              {it.name}:
                            </span>{" "}
                            {it.ability?.name}
                            {it.ability?.description
                              ? ` — ${it.ability.description}`
                              : ""}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )
            })}
            {result.blocked.map((b) => (
              <div
                key={b.character.id}
                className="rounded-card border border-warning/60 bg-surface p-4 text-on-surface"
              >
                <h3 className="font-display text-h2">{b.character.name}</h3>
                <ul className="mt-2 space-y-1 text-small">
                  <li>
                    <span className="text-text-muted">
                      {b.reason.toLowerCase().includes("weapon")
                        ? "Weapon:"
                        : "Armor:"}
                    </span>{" "}
                    <span className="text-warning">(none available)</span>
                  </li>
                </ul>
                <p className="mt-2 text-small text-warning">{b.reason}</p>
              </div>
            ))}
          </div>

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

