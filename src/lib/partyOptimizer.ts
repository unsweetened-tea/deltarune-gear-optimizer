import type { Character, InventoryMode, Item, Stats } from "../types/data"
import {
  canEquip,
  enumerateArmorSelections,
  isAvailable,
  totalStats,
} from "./optimizer"

export type PartyObjective = "sum" | "maximin"

export interface MemberLoadout {
  weapon: Item
  armor: Item[]
  totals: Stats
  /** Weighted score: sum of weight[s] * totals[s]. */
  score: number
}

export interface MemberAssignment extends MemberLoadout {
  character: Character
}

export interface LeftoverItem {
  item: Item
  unused: number
}

export interface PartyOptimizeInput {
  party: Character[]
  items: Item[]
  weights: Stats
  objective: PartyObjective
  chaptersEnabled: number[]
  inventoryMode: InventoryMode
}

export type PartyOptimizeResult =
  | {
      ok: true
      assignments: MemberAssignment[]
      objectiveScore: number
      leftovers: LeftoverItem[]
    }
  | { ok: false; reason: string }

function weightedScore(totals: Stats, weights: Stats): number {
  return (
    weights.hp * totals.hp +
    weights.atk * totals.atk +
    weights.def * totals.def +
    weights.magic * totals.magic
  )
}

/**
 * All individually-valid loadouts for one member, sorted by weighted
 * score descending. Shared-pool feasibility across members is NOT
 * checked here — that is the search's job.
 */
export function enumerateMemberLoadouts(
  character: Character,
  items: Item[],
  weights: Stats,
  chaptersEnabled: number[],
  inventoryMode: InventoryMode,
): MemberLoadout[] {
  const eligible = items.filter(
    (it) =>
      canEquip(it, character) &&
      isAvailable(it, chaptersEnabled, inventoryMode),
  )
  const weapons = eligible.filter((it) => it.type === "weapon")
  const armorCandidates = eligible.filter((it) => it.type === "armor")

  let armorSelections = enumerateArmorSelections(
    armorCandidates,
    character.slots.armor,
    inventoryMode,
  )
  if (!character.armorRemovable) {
    armorSelections = armorSelections.filter((sel) => sel.length > 0)
  }

  const loadouts: MemberLoadout[] = []
  for (const weapon of weapons) {
    for (const armor of armorSelections) {
      const totals = totalStats(character, [weapon, ...armor])
      loadouts.push({
        weapon,
        armor,
        totals,
        score: weightedScore(totals, weights),
      })
    }
  }
  loadouts.sort((a, b) => b.score - a.score)
  return loadouts
}

function loadoutUsage(loadout: MemberLoadout): Map<string, number> {
  const usage = new Map<string, number>()
  usage.set(loadout.weapon.id, 1)
  for (const a of loadout.armor) {
    usage.set(a.id, (usage.get(a.id) ?? 0) + 1)
  }
  return usage
}

function fits(usage: Map<string, number>, inventory: Map<string, number>): boolean {
  for (const [id, count] of usage) {
    if ((inventory.get(id) ?? 0) < count) return false
  }
  return true
}

interface SearchMember {
  character: Character
  loadouts: MemberLoadout[]
  usages: Map<string, number>[]
}

interface SearchSolution {
  picks: number[]
  score: number
}

/**
 * Exact branch-and-bound over the shared owned pool.
 *
 * Bounds: each member's best individually-valid loadout score ignores
 * the pool, so it can only overestimate what is jointly achievable —
 * a valid optimistic bound for both objectives. Members are ordered
 * most-constrained-first; per-member loadouts are sorted descending,
 * so once a loadout's optimistic bound cannot beat the incumbent, no
 * later loadout for that member can either and the branch breaks.
 */
function solvePool(
  members: SearchMember[],
  objective: PartyObjective,
  inventory: Map<string, number>,
): SearchSolution | null {
  const n = members.length
  const bestScores = members.map((m) => m.loadouts[0]?.score ?? -Infinity)

  // suffix[i] = optimistic score achievable by members i..n-1
  const suffix = new Array<number>(n + 1)
  suffix[n] = objective === "sum" ? 0 : Infinity
  for (let i = n - 1; i >= 0; i--) {
    suffix[i] =
      objective === "sum"
        ? suffix[i + 1] + bestScores[i]
        : Math.min(suffix[i + 1], bestScores[i])
  }

  let bestScore = -Infinity
  let bestPicks: number[] | null = null
  const picks = new Array<number>(n).fill(-1)

  // Greedy first-fit seed to establish a lower bound before searching.
  {
    const inv = new Map(inventory)
    const greedy: number[] = []
    let score = objective === "sum" ? 0 : Infinity
    let complete = true
    for (const member of members) {
      const idx = member.usages.findIndex((u) => fits(u, inv))
      if (idx === -1) {
        complete = false
        break
      }
      greedy.push(idx)
      for (const [id, count] of member.usages[idx]) {
        inv.set(id, (inv.get(id) ?? 0) - count)
      }
      const s = member.loadouts[idx].score
      score = objective === "sum" ? score + s : Math.min(score, s)
    }
    if (complete) {
      bestScore = score
      bestPicks = [...greedy]
    }
  }

  function dfs(i: number, partial: number): void {
    if (i === n) {
      if (partial > bestScore || bestPicks === null) {
        bestScore = partial
        bestPicks = [...picks]
      }
      return
    }
    const member = members[i]
    for (let j = 0; j < member.loadouts.length; j++) {
      const s = member.loadouts[j].score
      const optimistic =
        objective === "sum"
          ? partial + s + suffix[i + 1]
          : Math.min(partial, s, suffix[i + 1])
      // Loadouts are sorted descending, so every later j is no better.
      if (optimistic <= bestScore && bestPicks !== null) break
      const usage = member.usages[j]
      if (!fits(usage, inventory)) continue
      for (const [id, count] of usage) {
        inventory.set(id, (inventory.get(id) ?? 0) - count)
      }
      picks[i] = j
      dfs(
        i + 1,
        objective === "sum" ? partial + s : Math.min(partial, s),
      )
      for (const [id, count] of usage) {
        inventory.set(id, (inventory.get(id) ?? 0) + count)
      }
    }
    picks[i] = -1
  }

  dfs(0, objective === "sum" ? 0 : Infinity)

  if (bestPicks === null) return null
  return { picks: bestPicks, score: bestScore }
}

export function optimizeParty(input: PartyOptimizeInput): PartyOptimizeResult {
  const { party, items, weights, objective, chaptersEnabled, inventoryMode } =
    input

  if (party.length === 0) {
    return { ok: false, reason: "No active party members selected." }
  }

  // Per-member degenerate checks with specific messages.
  for (const character of party) {
    const eligible = items.filter(
      (it) =>
        canEquip(it, character) &&
        isAvailable(it, chaptersEnabled, inventoryMode),
    )
    if (!eligible.some((it) => it.type === "weapon")) {
      return {
        ok: false,
        reason: `${character.name} has no equippable weapon with the current filters (check chapter filter, inventory mode, and owned counts).`,
      }
    }
    if (
      !character.armorRemovable &&
      !eligible.some((it) => it.type === "armor")
    ) {
      return {
        ok: false,
        reason: `${character.name} cannot unequip armor, but no armor is available with the current filters.`,
      }
    }
  }

  const memberLoadouts = party.map((character) => ({
    character,
    loadouts: enumerateMemberLoadouts(
      character,
      items,
      weights,
      chaptersEnabled,
      inventoryMode,
    ),
  }))

  let assignments: MemberAssignment[]

  if (inventoryMode === "unlimited") {
    // No shared pool: each member independently takes their best.
    assignments = memberLoadouts.map(({ character, loadouts }) => ({
      character,
      ...loadouts[0],
    }))
  } else {
    // Shared pool: exact branch-and-bound, most-constrained member first.
    const ordered: SearchMember[] = memberLoadouts
      .map(({ character, loadouts }) => ({
        character,
        loadouts,
        usages: loadouts.map(loadoutUsage),
      }))
      .sort((a, b) => a.loadouts.length - b.loadouts.length)

    const inventory = new Map<string, number>()
    for (const it of items) {
      if (it.owned > 0) inventory.set(it.id, it.owned)
    }

    const solution = solvePool(ordered, objective, inventory)
    if (!solution) {
      return {
        ok: false,
        reason:
          "The owned pool cannot equip every party member at once (not enough weapons/armor to go around). Add owned counts or switch to unlimited mode.",
      }
    }

    const byId = new Map(
      ordered.map((m, i) => [
        m.character.id,
        { character: m.character, ...m.loadouts[solution.picks[i]] },
      ]),
    )
    // Restore the caller's party order.
    assignments = party.map((c) => byId.get(c.id) as MemberAssignment)
  }

  const objectiveScore =
    objective === "sum"
      ? assignments.reduce((acc, a) => acc + a.score, 0)
      : Math.min(...assignments.map((a) => a.score))

  const used = new Map<string, number>()
  for (const a of assignments) {
    for (const [id, count] of loadoutUsage(a)) {
      used.set(id, (used.get(id) ?? 0) + count)
    }
  }
  const leftovers: LeftoverItem[] = items
    .filter((it) => it.owned > 0)
    .map((it) => ({ item: it, unused: it.owned - (used.get(it.id) ?? 0) }))
    .filter(({ unused }) => unused > 0)

  return { ok: true, assignments, objectiveScore, leftovers }
}
