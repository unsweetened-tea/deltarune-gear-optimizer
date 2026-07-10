import { useState } from "react"
import type {
  Character,
  InventoryMode,
  Item,
  Preset,
  PresetCategory,
  PresetObjective,
  Stats,
} from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { optimizeParty } from "../lib/partyOptimizer"
import { toPartyObjective } from "../lib/presets"
import { slugify, uniqueSlug } from "../lib/slug"

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

function weightsLabel(weights: Stats): string {
  return STAT_KEYS.map((s) => `${s.toUpperCase()} ${weights[s]}`).join(" · ")
}

function objectiveLabel(objective: PresetObjective): string {
  return objective === "weightedSum" ? "Weighted sum" : "Maximin"
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
  const result =
    preset && party.length > 0
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
      <nav className="flex gap-1 border-b border-gray-200">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectCategory(c.id)}
            className={
              "px-4 py-2 text-sm font-medium " +
              (category === c.id
                ? "border-b-2 border-purple-600 text-purple-600"
                : "text-gray-500 hover:text-gray-700")
            }
          >
            {c.label}
          </button>
        ))}
      </nav>

      {category === "boss" && (
        <p className="text-xs text-gray-500">
          Boss presets are saved stat-weight presets you define yourself —
          they are not combat simulations. Encode what you think a fight
          demands.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {categoryPresets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPreset(p.id)}
            className={
              "rounded-full border px-4 py-1.5 text-sm font-medium " +
              (preset?.id === p.id
                ? "border-purple-600 bg-purple-600 text-white"
                : "border-gray-300 text-gray-700 hover:border-purple-400")
            }
          >
            {p.label}
          </button>
        ))}
        {category === "boss" && categoryPresets.length === 0 && (
          <p className="text-sm text-gray-500">
            No boss presets yet — add one below.
          </p>
        )}
      </div>

      {preset && (
        <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
          <span className="font-semibold">{preset.label}</span>
          <span className="ml-3 text-gray-600">
            {weightsLabel(preset.weights)}
          </span>
          <span className="ml-3 rounded bg-gray-200 px-2 py-0.5 text-xs font-medium">
            {objectiveLabel(preset.objective)}
          </span>
          {preset.notes && (
            <p className="mt-1 text-xs text-gray-600">{preset.notes}</p>
          )}
        </div>
      )}

      {category === "boss" && <BossEditor selectPreset={selectPreset} />}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Party members</legend>
          Party
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
          Chapters
          {[1, 2, 3, 4, 5].map((c) => (
            <label key={c} className="flex items-center gap-1">
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
          Inventory
          <select
            value={inventoryMode}
            onChange={(e) => setInventoryMode(e.target.value as InventoryMode)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            <option value="owned">Owned only</option>
            <option value="unlimited">Unlimited</option>
          </select>
        </label>
      </div>

      {recentlyUnavailable.length > 0 && (
        <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm">
          <h3 className="text-xs font-semibold uppercase text-blue-800">
            Recently marked unavailable (owned set to 0)
          </h3>
          <ul className="mt-1 space-y-1">
            {recentlyUnavailable.map((entry, i) => (
              <li key={i} className="flex items-center gap-2">
                <span>{entry.itemName}</span>
                <button
                  type="button"
                  onClick={() => undoUnavailable(entry)}
                  className="rounded border border-blue-400 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100"
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dataset.items.length === 0 ? (
        <p className="rounded border border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
          No items in your dataset yet. Paste gear tables in the{" "}
          <span className="font-medium">Import</span> tab (or add items by
          hand in <span className="font-medium">Items</span>) and results
          will appear here automatically.
        </p>
      ) : party.length === 0 ? (
        <p className="rounded border border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
          No active party members — check at least one character above.
        </p>
      ) : !preset ? (
        <p className="rounded border border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
          Select or create a preset to see results.
        </p>
      ) : result && !result.ok ? (
        <p className="rounded border border-amber-400 bg-amber-50 p-4 text-sm text-amber-800">
          {result.reason}
        </p>
      ) : result?.ok ? (
        <>
          <div className="rounded border border-purple-300 bg-purple-50 p-4 text-sm">
            <span className="font-semibold text-purple-800">
              {preset.label} · {objectiveLabel(preset.objective)} ·{" "}
              {inventoryMode === "owned" ? "Owned pool (shared)" : "Unlimited"}
            </span>
            <span className="ml-3 text-lg font-bold text-purple-800">
              {result.objectiveScore}
            </span>
            {preset.objective === "maximin" && (
              <span className="ml-2 text-purple-700">
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

          <p className="text-xs text-gray-500">
            <span className="font-medium">Remove</span> empties that slot for
            this build only (resets when you switch preset).{" "}
            <span className="font-medium">I don&apos;t have this</span>{" "}
            permanently sets the item&apos;s owned count to 0 in your dataset
            — undo above if misclicked.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {result.assignments.map((a) => {
              const original = datasetCharacter(a.character.id)
              const locked = locks[a.character.id] ?? 0
              const remainingSlots =
                (original?.slots.armor ?? 2) - locked
              const lastArmorProtected =
                original !== undefined &&
                !original.armorRemovable &&
                remainingSlots <= 1
              return (
                <div
                  key={a.character.id}
                  className="rounded border border-gray-200 p-4"
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">
                      {a.character.name}
                    </h3>
                    <span className="text-xs text-gray-500">
                      weighted score {a.score}
                    </span>
                  </div>

                  <ul className="mt-2 space-y-1 text-sm">
                    <li className="flex items-center gap-2">
                      <span>
                        <span className="font-medium">Weapon:</span>{" "}
                        {a.weapon.name}
                      </span>
                      <button
                        type="button"
                        disabled
                        title="A weapon slot can never be empty."
                        className="cursor-not-allowed rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-300"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => markUnavailable(a.weapon)}
                        className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        I don&apos;t have this
                      </button>
                    </li>
                    {a.armor.map((piece, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span>
                          <span className="font-medium">Armor:</span>{" "}
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
                              ? "cursor-not-allowed rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-300"
                              : "rounded border border-gray-400 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                          }
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => markUnavailable(piece)}
                          className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                        >
                          I don&apos;t have this
                        </button>
                      </li>
                    ))}
                    {Array.from({ length: locked }, (_, i) => (
                      <li key={`locked-${i}`} className="text-gray-400">
                        <span className="font-medium">Armor:</span> (locked
                        empty)
                      </li>
                    ))}
                  </ul>

                  {locked > 0 && (
                    <button
                      type="button"
                      onClick={() => resetLocks(a.character.id)}
                      className="mt-2 rounded border border-gray-400 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Unlock {locked} slot(s)
                    </button>
                  )}

                  <div className="mt-3 flex gap-2">
                    {STAT_KEYS.map((stat) => (
                      <div
                        key={stat}
                        className="rounded bg-gray-100 px-2 py-1 text-center"
                      >
                        <div className="text-[10px] font-medium uppercase text-gray-500">
                          {stat}
                        </div>
                        <div className="text-sm font-bold">
                          {a.totals[stat]}
                        </div>
                      </div>
                    ))}
                  </div>

                  {[a.weapon, ...a.armor].some((it) => it.ability) && (
                    <ul className="mt-3 space-y-1 rounded border border-amber-300 bg-amber-50 p-2 text-xs">
                      {[a.weapon, ...a.armor]
                        .filter((it) => it.ability)
                        .map((it, i) => (
                          <li key={i}>
                            <span className="font-medium">{it.name}:</span>{" "}
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
          </div>

          {inventoryMode === "owned" && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">
                Leftover inventory
              </h3>
              {result.leftovers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Every owned item is equipped.
                </p>
              ) : (
                <ul className="text-sm text-gray-700">
                  {result.leftovers.map(({ item, unused }) => (
                    <li key={item.id}>
                      {item.name} × {unused}
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

function BossEditor({
  selectPreset,
}: {
  selectPreset: (id: string) => void
}) {
  const { dataset, setDataset } = useDataset()
  const [label, setLabel] = useState("")
  const [weights, setWeights] = useState<Stats>({
    hp: 0,
    atk: 0,
    def: 1,
    magic: 0,
  })
  const [objective, setObjective] = useState<PresetObjective>("maximin")
  const [notes, setNotes] = useState("")

  const bosses = dataset.presets.filter((p) => p.category === "boss")

  function updatePreset(id: string, patch: Partial<Preset>) {
    setDataset((prev) => ({
      ...prev,
      presets: prev.presets.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }

  function deletePreset(id: string) {
    setDataset((prev) => ({
      ...prev,
      presets: prev.presets.filter((p) => p.id !== id),
    }))
  }

  function addBoss() {
    const trimmed = label.trim()
    if (!trimmed) return
    const id = uniqueSlug(
      `boss-${slugify(trimmed)}`,
      new Set(dataset.presets.map((p) => p.id)),
    )
    const boss: Preset = {
      id,
      label: trimmed,
      category: "boss",
      weights: { ...weights },
      objective,
      notes: notes.trim() || undefined,
    }
    setDataset((prev) => ({ ...prev, presets: [...prev.presets, boss] }))
    setLabel("")
    setNotes("")
    selectPreset(id)
  }

  return (
    <div className="space-y-3">
      {bosses.map((boss) => (
        <div
          key={boss.id}
          className="flex flex-wrap items-center gap-2 rounded border border-gray-200 p-2 text-sm"
        >
          <input
            value={boss.label}
            onChange={(e) => updatePreset(boss.id, { label: e.target.value })}
            className="w-32 rounded border border-gray-300 px-2 py-1"
            aria-label="Boss name"
          />
          {STAT_KEYS.map((stat) => (
            <label key={stat} className="flex items-center gap-1 text-xs">
              {stat.toUpperCase()}
              <input
                type="number"
                step="any"
                value={boss.weights[stat]}
                onChange={(e) =>
                  updatePreset(boss.id, {
                    weights: {
                      ...boss.weights,
                      [stat]:
                        e.target.value === "" ? 0 : Number(e.target.value),
                    },
                  })
                }
                className="w-14 rounded border border-gray-300 px-1 py-0.5"
              />
            </label>
          ))}
          <select
            value={boss.objective}
            onChange={(e) =>
              updatePreset(boss.id, {
                objective: e.target.value as PresetObjective,
              })
            }
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="weightedSum">Weighted sum</option>
            <option value="maximin">Maximin</option>
          </select>
          <input
            value={boss.notes ?? ""}
            onChange={(e) =>
              updatePreset(boss.id, { notes: e.target.value || undefined })
            }
            placeholder="Notes"
            className="min-w-40 flex-1 rounded border border-gray-300 px-2 py-1"
            aria-label="Boss notes"
          />
          <button
            type="button"
            onClick={() => deletePreset(boss.id)}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 rounded border border-dashed border-gray-300 p-2 text-sm">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Boss name"
          className="w-32 rounded border border-gray-300 px-2 py-1"
        />
        {STAT_KEYS.map((stat) => (
          <label key={stat} className="flex items-center gap-1 text-xs">
            {stat.toUpperCase()}
            <input
              type="number"
              step="any"
              value={weights[stat]}
              onChange={(e) =>
                setWeights((prev) => ({
                  ...prev,
                  [stat]: e.target.value === "" ? 0 : Number(e.target.value),
                }))
              }
              className="w-14 rounded border border-gray-300 px-1 py-0.5"
            />
          </label>
        ))}
        <select
          value={objective}
          onChange={(e) => setObjective(e.target.value as PresetObjective)}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        >
          <option value="weightedSum">Weighted sum</option>
          <option value="maximin">Maximin</option>
        </select>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (what does this fight demand?)"
          className="min-w-40 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <button
          type="button"
          onClick={addBoss}
          disabled={!label.trim()}
          className="rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Add boss
        </button>
      </div>
    </div>
  )
}
