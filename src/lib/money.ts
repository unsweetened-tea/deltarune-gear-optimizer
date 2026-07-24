import type {
  Character,
  Item,
  MoneySettings,
} from "../types/data"

export const DEFAULT_MONEY_SETTINGS: MoneySettings = {
  stackMode: "additive",
  scope: "party-wide",
}

/** Percent change to Dark Dollars this item grants, 0 if it has none. */
export function moneyOf(item: Item): number {
  return item.moneyModifier ?? 0
}

/** Whether any reachable item carries a money modifier worth optimizing for. */
export function datasetHasMoneyGear(items: Item[]): boolean {
  return items.some((it) => moneyOf(it) !== 0)
}

/**
 * A member's money score for the SEARCH, always the additive sum of the
 * equipped modifiers — deliberately money-monotonic. Because more money
 * is always a better score and a negative item strictly lowers it, the
 * "sum" objective only ever equips a negative item when no non-negative
 * one fits that slot (out of stock, or claimed by another member from the
 * shared pool). That is exactly guardrail D — "never a negative unless it
 * is the only legal option" — enforced by scoring rather than a filter,
 * so it can't wrongly reject a negative that pool competition made
 * unavoidable.
 *
 * Scope and stackMode never affect the search; they only change how the
 * final total is reported, which computePartyMoney handles.
 */
export function memberMoneyScore(equipped: Item[]): number {
  return equipped.reduce((acc, it) => acc + moneyOf(it), 0)
}

/** Sorted ids of the money-bearing items in a loadout — its money identity. */
export function moneySignature(equipped: Item[]): string {
  return equipped
    .filter((it) => moneyOf(it) !== 0)
    .map((it) => it.id)
    .sort()
    .join(",")
}

/**
 * Money mode only cares about money items; the many zero-money "fillers"
 * are interchangeable except that the shared pool can run one short. Only
 * `cap` distinct fillers per type can ever be needed at once (party size ×
 * slots), so keeping the most-plentiful `cap` of them — alongside every
 * money item — preserves the optimum while bounding the search. Fewer
 * fillers than that are all kept.
 */
export function capMoneyFillers(items: Item[], cap: number): Item[] {
  const money = items.filter((it) => moneyOf(it) !== 0)
  const byType = (type: Item["type"]) =>
    items
      .filter((it) => moneyOf(it) === 0 && it.type === type)
      .sort((a, b) => b.owned - a.owned)
      .slice(0, cap)
  return [...money, ...byType("weapon"), ...byType("armor")]
}

export interface MoneyContribution {
  itemId: string
  itemName: string
  characterId: string
  characterName: string
  percent: number
  /**
   * True for an equipped negative item. Under additive money scoring a
   * negative is only ever equipped when it was the sole legal option, so
   * a negative contribution is by construction a forced one.
   */
  forced: boolean
}

export interface MoneyBreakdown {
  settings: MoneySettings
  /** Aggregated party bonus, in percent. */
  totalPercent: number
  /** Items whose modifier is actually counted in the total. */
  contributions: MoneyContribution[]
  /** Negative items equipped only because a slot had no alternative. */
  forcedNegatives: MoneyContribution[]
  assumptionText: string
}

export interface MoneyMember {
  character: Character
  equipped: Item[]
}

function compound(percents: number[]): number {
  const factor = percents.reduce((acc, p) => acc * (1 + p / 100), 1)
  return (factor - 1) * 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function moneyAssumptionText(settings: MoneySettings): string {
  const combine =
    settings.stackMode === "additive"
      ? "stack additively (percents add up)"
      : "compound (percents multiply together)"
  const which =
    settings.scope === "party-wide"
      ? "every equipped money item across the party"
      : "only each character's single best money item"
  return `Assuming ${which} ${settings.scope === "party-wide" ? "counts, and bonuses" : "counts, and those"} ${combine}.`
}

/**
 * The reported party money bonus and its breakdown, computed from the
 * final assignment. This is where scope and stackMode are actually
 * interpreted; the search only had to rank loadouts.
 */
export function computePartyMoney(
  members: MoneyMember[],
  settings: MoneySettings,
): MoneyBreakdown {
  const all: MoneyContribution[] = []
  for (const { character, equipped } of members) {
    for (const item of equipped) {
      const percent = moneyOf(item)
      if (percent === 0) continue
      all.push({
        itemId: item.id,
        itemName: item.name,
        characterId: character.id,
        characterName: character.name,
        percent,
        forced: percent < 0,
      })
    }
  }

  // Which contributions actually count depends on scope.
  let counted: MoneyContribution[]
  if (settings.scope === "party-wide") {
    counted = all
  } else {
    // One per character: the single highest-value money item they carry.
    const bestByCharacter = new Map<string, MoneyContribution>()
    for (const c of all) {
      const cur = bestByCharacter.get(c.characterId)
      if (!cur || c.percent > cur.percent) bestByCharacter.set(c.characterId, c)
    }
    counted = [...bestByCharacter.values()]
  }

  const totalPercent =
    settings.stackMode === "additive"
      ? round1(counted.reduce((acc, c) => acc + c.percent, 0))
      : round1(compound(counted.map((c) => c.percent)))

  return {
    settings,
    totalPercent,
    contributions: counted,
    forcedNegatives: counted.filter((c) => c.percent < 0 && c.forced),
    assumptionText: moneyAssumptionText(settings),
  }
}
