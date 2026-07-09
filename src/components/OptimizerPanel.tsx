import { useMemo, useState } from "react"
import type { InventoryMode, Item, Stats } from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { optimize, type ScoredLoadout } from "../lib/optimizer"

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

const TOP_N = 5

function equippedItems(loadout: ScoredLoadout): Item[] {
  return [loadout.weapon, ...loadout.armor]
}

function abilitiesOf(loadout: ScoredLoadout): { item: Item; index: number }[] {
  return equippedItems(loadout)
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.ability !== undefined)
}

function armorLabel(armor: Item[]): string {
  if (armor.length === 0) return "(no armor)"
  return armor.map((a) => a.name).join(" + ")
}

export function OptimizerPanel() {
  const { dataset, setDataset } = useDataset()
  const [characterId, setCharacterId] = useState(
    dataset.characters.find((c) => c.active)?.id ??
      dataset.characters[0]?.id ??
      "",
  )
  const [targetStat, setTargetStat] = useState<keyof Stats>("atk")

  const character = dataset.characters.find((c) => c.id === characterId)
  const { chaptersEnabled, inventoryMode } = dataset.settings

  const result = useMemo(() => {
    if (!character) return null
    return optimize({
      character,
      items: dataset.items,
      targetStat,
      chaptersEnabled,
      inventoryMode,
    })
  }, [character, dataset.items, targetStat, chaptersEnabled, inventoryMode])

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

  const top = result?.ok ? result.loadouts.slice(0, TOP_N) : []
  const best = top[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Character
          <select
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {dataset.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          Maximize
          <select
            value={targetStat}
            onChange={(e) => setTargetStat(e.target.value as keyof Stats)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {STAT_KEYS.map((stat) => (
              <option key={stat} value={stat}>
                {stat.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

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

      {!character && (
        <p className="text-sm text-gray-500">No character selected.</p>
      )}

      {result && !result.ok && (
        <p className="rounded border border-amber-400 bg-amber-50 p-4 text-sm text-amber-800">
          {result.reason}
        </p>
      )}

      {character && result?.ok && best && (
        <>
          <div className="rounded border border-purple-300 bg-purple-50 p-4">
            <h3 className="text-sm font-semibold text-purple-800">
              Best loadout for {character.name} — max {targetStat.toUpperCase()}
            </h3>
            <p className="mt-2 text-sm">
              <span className="font-medium">Weapon:</span> {best.weapon.name}
            </p>
            <p className="text-sm">
              <span className="font-medium">Armor:</span>{" "}
              {armorLabel(best.armor)}
            </p>

            <div className="mt-3 flex gap-4">
              {STAT_KEYS.map((stat) => (
                <div
                  key={stat}
                  className={
                    "rounded px-3 py-2 text-center " +
                    (stat === targetStat
                      ? "bg-purple-600 text-white"
                      : "bg-white text-gray-800")
                  }
                >
                  <div className="text-xs font-medium uppercase">{stat}</div>
                  <div className="text-lg font-bold">{best.totals[stat]}</div>
                </div>
              ))}
            </div>

            {abilitiesOf(best).length > 0 && (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3">
                <h4 className="text-xs font-semibold uppercase text-amber-800">
                  Abilities (not scored — judge for yourself)
                </h4>
                <ul className="mt-1 space-y-1 text-sm">
                  {abilitiesOf(best).map(({ item, index }) => (
                    <li key={index}>
                      <span className="font-medium">{item.name}:</span>{" "}
                      {item.ability?.name}
                      {item.ability?.description
                        ? ` — ${item.ability.description}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Top {top.length} loadout(s){" "}
              <span className="font-normal text-gray-500">
                of {result.loadouts.length} evaluated
              </span>
            </h3>
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Weapon</th>
                    <th className="p-2 text-left">Armor</th>
                    {STAT_KEYS.map((stat) => (
                      <th
                        key={stat}
                        className={
                          "p-2 text-left uppercase " +
                          (stat === targetStat ? "text-purple-700" : "")
                        }
                      >
                        {stat}
                      </th>
                    ))}
                    <th className="p-2 text-left">Abilities</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((loadout, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2">{loadout.weapon.name}</td>
                      <td className="p-2">{armorLabel(loadout.armor)}</td>
                      {STAT_KEYS.map((stat) => (
                        <td
                          key={stat}
                          className={
                            "p-2 " +
                            (stat === targetStat
                              ? "font-bold text-purple-700"
                              : "")
                          }
                        >
                          {loadout.totals[stat]}
                        </td>
                      ))}
                      <td className="p-2">
                        {abilitiesOf(loadout)
                          .map(
                            ({ item }) => `${item.name}: ${item.ability?.name}`,
                          )
                          .join("; ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
