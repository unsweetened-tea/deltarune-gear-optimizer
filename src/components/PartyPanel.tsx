import { useMemo, useState } from "react"
import type { InventoryMode, Item, Stats } from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { optimizeParty, type PartyObjective } from "../lib/partyOptimizer"

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

function armorLabel(armor: Item[]): string {
  if (armor.length === 0) return "(no armor)"
  return armor.map((a) => a.name).join(" + ")
}

export function PartyPanel() {
  const { dataset, setDataset } = useDataset()
  const [weights, setWeights] = useState<Stats>({
    hp: 1,
    atk: 1,
    def: 1,
    magic: 1,
  })
  const [objective, setObjective] = useState<PartyObjective>("sum")

  const party = dataset.characters.filter((c) => c.active)
  const { chaptersEnabled, inventoryMode } = dataset.settings

  const result = useMemo(
    () =>
      optimizeParty({
        party,
        items: dataset.items,
        weights,
        objective,
        chaptersEnabled,
        inventoryMode,
      }),
    [party, dataset.items, weights, objective, chaptersEnabled, inventoryMode],
  )

  function toggleActive(id: string) {
    setDataset((prev) => ({
      ...prev,
      characters: prev.characters.map((c) =>
        c.id === id ? { ...c, active: !c.active } : c,
      ),
    }))
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

  const objectiveLabel =
    objective === "sum" ? "Weighted sum" : "Maximin (weakest member)"
  const modeLabel =
    inventoryMode === "owned" ? "Owned pool (shared)" : "Unlimited"

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <fieldset className="flex items-center gap-3">
          <legend className="sr-only">Stat weights</legend>
          Weights
          {STAT_KEYS.map((stat) => (
            <label key={stat} className="flex items-center gap-1">
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
                className="w-16 rounded border border-gray-300 px-1 py-0.5"
              />
            </label>
          ))}
        </fieldset>

        <fieldset className="flex items-center gap-3">
          <legend className="sr-only">Objective</legend>
          Objective
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="objective"
              checked={objective === "sum"}
              onChange={() => setObjective("sum")}
            />
            Weighted sum
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="objective"
              checked={objective === "maximin"}
              onChange={() => setObjective("maximin")}
            />
            Maximin
          </label>
        </fieldset>
      </div>

      {!result.ok && (
        <p className="rounded border border-amber-400 bg-amber-50 p-4 text-sm text-amber-800">
          {result.reason}
        </p>
      )}

      {result.ok && (
        <>
          <div className="rounded border border-purple-300 bg-purple-50 p-4 text-sm">
            <span className="font-semibold text-purple-800">
              {objectiveLabel} · {modeLabel}
            </span>
            <span className="ml-3 text-lg font-bold text-purple-800">
              {result.objectiveScore}
            </span>
            {objective === "maximin" && (
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

          <div className="grid gap-4 md:grid-cols-2">
            {result.assignments.map((a) => (
              <div
                key={a.character.id}
                className="rounded border border-gray-200 p-4"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">{a.character.name}</h3>
                  <span className="text-xs text-gray-500">
                    weighted score {a.score}
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Weapon:</span> {a.weapon.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Armor:</span>{" "}
                  {armorLabel(a.armor)}
                </p>

                <div className="mt-3 flex gap-2">
                  {STAT_KEYS.map((stat) => (
                    <div
                      key={stat}
                      className="rounded bg-gray-100 px-2 py-1 text-center"
                    >
                      <div className="text-[10px] font-medium uppercase text-gray-500">
                        {stat}
                      </div>
                      <div className="text-sm font-bold">{a.totals[stat]}</div>
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
            ))}
          </div>

          {inventoryMode === "owned" && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Leftover inventory</h3>
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
      )}
    </div>
  )
}
