import { useMemo, useState } from "react"
import type { InventoryMode, Item, Stats } from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { optimize, type ScoredLoadout } from "../lib/optimizer"
import { STAT_BORDER_CLASS, STAT_TEXT_CLASS } from "../lib/statColors"

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

  const selectClass =
    "rounded border border-border bg-void px-2 py-1 text-on-void"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-small">
        <label className="flex items-center gap-2">
          <span className="text-text-muted">Character</span>
          <select
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className={selectClass}
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
          <span className="text-text-muted">Maximize</span>
          <select
            value={targetStat}
            onChange={(e) => setTargetStat(e.target.value as keyof Stats)}
            className={selectClass}
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
            className={selectClass}
          >
            <option value="owned">Owned only</option>
            <option value="unlimited">Unlimited</option>
          </select>
        </label>
      </div>

      {!character && (
        <p className="text-small text-text-muted">No character selected.</p>
      )}

      {result && !result.ok && (
        <p className="rounded-card border border-warning/60 bg-surface p-4 text-small text-on-surface">
          <span className="font-semibold text-warning">Can’t optimize: </span>
          {result.reason}
        </p>
      )}

      {character && result?.ok && best && (
        <>
          <div className="rounded-card border border-soul/40 bg-surface p-4 text-on-surface">
            <h3 className="font-display text-h2 text-soul">
              Best loadout for {character.name} — max{" "}
              <span className={STAT_TEXT_CLASS[targetStat]}>
                {targetStat.toUpperCase()}
              </span>
            </h3>
            <p className="mt-2 text-small">
              <span className="text-text-muted">Weapon:</span>{" "}
              {best.weapon.name}
            </p>
            <p className="text-small">
              <span className="text-text-muted">Armor:</span>{" "}
              {armorLabel(best.armor)}
            </p>

            <div className="mt-3 flex gap-4">
              {STAT_KEYS.map((stat) => (
                <div
                  key={stat}
                  className={
                    "rounded border bg-surface-2 px-3 py-2 text-center text-on-surface-2 " +
                    (stat === targetStat
                      ? STAT_BORDER_CLASS[stat]
                      : "border-border")
                  }
                >
                  <div
                    className={`text-small font-medium uppercase ${STAT_TEXT_CLASS[stat]}`}
                  >
                    {stat}
                  </div>
                  <div
                    className={`font-mono text-h2 font-bold ${STAT_TEXT_CLASS[stat]}`}
                  >
                    {best.totals[stat]}
                  </div>
                </div>
              ))}
            </div>

            {abilitiesOf(best).length > 0 && (
              <div className="mt-3 rounded-card border border-warning/60 bg-surface-2 p-3 text-on-surface-2">
                <h4 className="text-small font-semibold uppercase text-warning">
                  Abilities (not scored — judge for yourself)
                </h4>
                <ul className="mt-1 space-y-1 text-small">
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
            <h3 className="mb-2 font-display text-h2 text-on-void">
              Top {top.length} loadout(s){" "}
              <span className="font-body text-small font-normal text-text-muted">
                of {result.loadouts.length} evaluated
              </span>
            </h3>
            <div className="overflow-x-auto rounded-card border border-border bg-surface text-on-surface">
              <table className="min-w-full text-small">
                <thead className="bg-surface-2 text-on-surface-2">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Weapon</th>
                    <th className="p-2 text-left">Armor</th>
                    {STAT_KEYS.map((stat) => (
                      <th
                        key={stat}
                        className={`p-2 text-left uppercase ${STAT_TEXT_CLASS[stat]} ${
                          stat === targetStat ? "underline" : ""
                        }`}
                      >
                        {stat}
                      </th>
                    ))}
                    <th className="p-2 text-left">Abilities</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((loadout, i) => (
                    <tr
                      key={i}
                      className="odd:bg-surface even:bg-surface-2"
                    >
                      <td className="p-2 font-mono">{i + 1}</td>
                      <td className="p-2">{loadout.weapon.name}</td>
                      <td className="p-2">{armorLabel(loadout.armor)}</td>
                      {STAT_KEYS.map((stat) => (
                        <td
                          key={stat}
                          className={`p-2 font-mono ${STAT_TEXT_CLASS[stat]} ${
                            stat === targetStat ? "font-bold" : ""
                          }`}
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
