import { useMemo, useState } from "react"
import type { InventoryMode, Item, Stats } from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { useMarkUnavailable } from "../hooks/useMarkUnavailable"
import { optimize, type ScoredLoadout } from "../lib/optimizer"
import { computePartyMoney, datasetHasMoneyGear } from "../lib/money"
import { STAT_TEXT_CLASS } from "../lib/statColors"
import type { MoneySettings } from "../types/data"
import {
  MoneyBreakdownCard,
  MoneySettingsControls,
} from "./results/MoneyBreakdown"
import { RecentlyUnavailable } from "./RecentlyUnavailable"
import { SoulHeart } from "./SoulHeart"
import { MarkUnavailableButton } from "./ui/DestructiveButtons"
import { Card } from "./ui/Card"
import { Delta } from "./ui/Delta"
import { SlotRow } from "./results/SlotRow"
import { StatBlock } from "./results/StatBlock"

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

type Target = keyof Stats | "money"

export function OptimizerPanel() {
  const { dataset, setDataset } = useDataset()
  const [characterId, setCharacterId] = useState(
    dataset.characters.find((c) => c.active)?.id ??
      dataset.characters[0]?.id ??
      "",
  )
  const [target, setTarget] = useState<Target>("atk")

  const { recentlyUnavailable, markUnavailable, undoUnavailable } =
    useMarkUnavailable()

  const character = dataset.characters.find((c) => c.id === characterId)
  const { chaptersEnabled, inventoryMode, moneySettings } = dataset.settings
  const moneyMode = target === "money"
  const hasMoneyGear = datasetHasMoneyGear(dataset.items)
  /** A real stat for the stat-only UI bits; falls back to ATK in money mode. */
  const statTarget: keyof Stats = moneyMode ? "atk" : target

  const result = useMemo(() => {
    if (!character) return null
    return optimize({
      character,
      items: dataset.items,
      targetStat: statTarget,
      chaptersEnabled,
      inventoryMode,
      money: moneyMode ? moneySettings : undefined,
    })
  }, [
    character,
    dataset.items,
    statTarget,
    chaptersEnabled,
    inventoryMode,
    moneyMode,
    moneySettings,
  ])

  const loadoutMoney = (loadout: ScoredLoadout): number =>
    character
      ? computePartyMoney(
          [{ character, equipped: [loadout.weapon, ...loadout.armor] }],
          moneySettings,
        ).totalPercent
      : 0

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

  function setMoneySettings(next: MoneySettings) {
    setDataset((prev) => ({
      ...prev,
      settings: { ...prev.settings, moneySettings: next },
    }))
  }

  const top = result?.ok ? result.loadouts.slice(0, TOP_N) : []
  const best = top[0]
  const bestMoney =
    moneyMode && best && character
      ? computePartyMoney(
          [{ character, equipped: [best.weapon, ...best.armor] }],
          moneySettings,
        )
      : null

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
            value={target}
            onChange={(e) => setTarget(e.target.value as Target)}
            className={selectClass}
          >
            {STAT_KEYS.map((stat) => (
              <option key={stat} value={stat}>
                {stat.toUpperCase()}
              </option>
            ))}
            <option value="money" disabled={!hasMoneyGear}>
              Money (D$)
            </option>
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

      {moneyMode && (
        <MoneySettingsControls
          settings={moneySettings}
          onChange={setMoneySettings}
        />
      )}

      <RecentlyUnavailable
        entries={recentlyUnavailable}
        onUndo={undoUnavailable}
      />

      {dataset.items.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-center text-small text-text-muted">
          No gear loaded yet — click{" "}
          <span className="font-medium text-on-surface">
            Reset to default data
          </span>{" "}
          above, or paste a wiki table in the{" "}
          <span className="font-medium text-on-surface">Import</span> tab.
        </p>
      ) : !character ? (
        <p className="text-small text-text-muted">
          Pick a character above to see their best loadout.
        </p>
      ) : result && !result.ok ? (
        <p className="rounded-card border border-warning/60 bg-surface p-4 text-small text-on-surface">
          <span className="font-semibold text-warning">Can’t optimize: </span>
          {result.reason}
        </p>
      ) : null}

      {dataset.items.length > 0 && character && result?.ok && best && (
        <>
          <Card tone="accent" className="space-y-3">
            <div className="flex items-center gap-2">
              <SoulHeart className="h-4 w-4 text-soul" />
              <h3 className="font-display text-h2 text-on-surface">
                Best loadout for {character.name} — max{" "}
                {moneyMode ? (
                  <span className="text-success">Money (D$)</span>
                ) : (
                  <span className={STAT_TEXT_CLASS[statTarget]}>
                    {statTarget.toUpperCase()}
                  </span>
                )}
              </h3>
            </div>

            <div className="space-y-2">
              <SlotRow
                slotLabel="Weapon"
                item={best.weapon}
                actions={
                  <MarkUnavailableButton
                    onClick={() => markUnavailable(best.weapon)}
                  />
                }
              />
              {best.armor.length === 0 && <SlotRow slotLabel="Armor" />}
              {best.armor.map((piece, i) => (
                <SlotRow
                  key={i}
                  slotLabel="Armor"
                  item={piece}
                  actions={
                    <MarkUnavailableButton
                      onClick={() => markUnavailable(piece)}
                    />
                  }
                />
              ))}
            </div>

            <StatBlock
              totals={best.totals}
              highlight={moneyMode ? undefined : statTarget}
            />
            <p className="text-small text-text-muted">
              {moneyMode
                ? "The four stats above are what this money build leaves you with — the cost of chasing Dark Dollars."
                : "Abilities are shown per item above — the optimizer never scores them, so they’re yours to weigh."}
            </p>
          </Card>

          {moneyMode && bestMoney && (
            <MoneyBreakdownCard breakdown={bestMoney} />
          )}

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
                          stat === statTarget && !moneyMode ? "underline" : ""
                        }`}
                      >
                        {stat}
                      </th>
                    ))}
                    <th className="p-2 text-left">
                      {moneyMode ? "D$ %" : `Δ ${statTarget.toUpperCase()}`}
                    </th>
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
                            stat === statTarget && !moneyMode ? "font-bold" : ""
                          }`}
                        >
                          {loadout.totals[stat]}
                        </td>
                      ))}
                      <td className="p-2">
                        {moneyMode ? (
                          <span className="font-mono tabular-nums text-success">
                            {loadoutMoney(loadout) > 0 ? "+" : ""}
                            {loadoutMoney(loadout)}%
                          </span>
                        ) : (
                          <Delta
                            value={
                              loadout.totals[statTarget] -
                              best.totals[statTarget]
                            }
                          />
                        )}
                      </td>
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
