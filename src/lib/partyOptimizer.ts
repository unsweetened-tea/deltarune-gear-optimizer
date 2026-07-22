import type { Character, InventoryMode, Item, Stats } from "../types/data"
import {
  beneficiaryScore,
  enumerateArmorSelections,
  isCandidateFor,
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

export interface ItemNote {
  itemId: string
  text: string
}

export interface MemberAssignment extends MemberLoadout {
  character: Character
  /** Why a specific item sits here when stats alone didn't decide it. */
  itemNotes: ItemNote[]
  /** Member-level notes, e.g. stats this character weights at zero. */
  memberNotes: string[]
}

export interface LeftoverItem {
  item: Item
  unused: number
}

/** A member the pool can't equip at all (e.g. their last weapon was pruned). */
export interface BlockedMember {
  character: Character
  reason: string
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
      /** Members with zero legal loadouts — shown per-slot, never silently dropped. */
      blocked: BlockedMember[]
      objectiveScore: number
      leftovers: LeftoverItem[]
    }
  | { ok: false; reason: string }

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

/**
 * Ties are compared with a relative tolerance rather than exact float
 * equality, so accumulated rounding doesn't hide a genuine tie. It stays
 * far too small to let a tiebreak overturn a real stat difference.
 */
const TIE_RELATIVE_EPSILON = 1e-6

function tieEpsilon(...values: number[]): number {
  return TIE_RELATIVE_EPSILON * Math.max(1, ...values.map(Math.abs))
}

/**
 * The objective's weights scaled by how much each stat matters for this
 * character: character relevance × objective weight. A character weight
 * of 0 removes that stat from their score entirely.
 */
export function effectiveWeights(character: Character, weights: Stats): Stats {
  const relevance = character.statWeights
  return {
    hp: weights.hp * relevance.hp,
    atk: weights.atk * relevance.atk,
    def: weights.def * relevance.def,
    magic: weights.magic * relevance.magic,
  }
}

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
  const eligible = items.filter((it) =>
    isCandidateFor(it, character, chaptersEnabled, inventoryMode),
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

  const scoringWeights = effectiveWeights(character, weights)
  const loadouts: MemberLoadout[] = []
  for (const weapon of weapons) {
    for (const armor of armorSelections) {
      const totals = totalStats(character, [weapon, ...armor])
      loadouts.push({
        weapon,
        armor,
        totals,
        score: weightedScore(totals, scoringWeights),
      })
    }
  }
  // Equal-scoring loadouts are ordered by beneficiary fit so the greedy
  // seed and the unlimited-mode pick start from the better-explained one.
  loadouts.sort((a, b) => {
    const delta = b.score - a.score
    if (Math.abs(delta) > tieEpsilon(a.score, b.score)) return delta
    return (
      beneficiaryScore(character, [b.weapon, ...b.armor]) -
      beneficiaryScore(character, [a.weapon, ...a.armor])
    )
  })
  return loadouts
}

export function loadoutUsage(loadout: MemberLoadout): Map<string, number> {
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

export interface SearchMember {
  character: Character
  loadouts: MemberLoadout[]
  usages: Map<string, number>[]
}

export interface SearchSolution {
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
 *
 * Ties are settled afterwards by improveBeneficiaryFit, never in here:
 * keeping equal-scoring branches alive to compare them made the search
 * combinatorial on presets where most loadouts tie.
 */
export function solvePool(
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

/** How far either side of a pick we'll look for an equal-scoring swap. */
const MAX_TIE_SCAN = 200

/** The contiguous run of loadouts scoring the same as `pick`, capped. */
function tieBand(loadouts: MemberLoadout[], pick: number): number[] {
  const target = loadouts[pick].score
  const band: number[] = []
  for (
    let j = pick;
    j >= 0 &&
    band.length < MAX_TIE_SCAN &&
    Math.abs(loadouts[j].score - target) <= tieEpsilon(loadouts[j].score, target);
    j--
  ) {
    band.push(j)
  }
  for (
    let j = pick + 1;
    j < loadouts.length &&
    band.length < MAX_TIE_SCAN * 2 &&
    Math.abs(loadouts[j].score - target) <= tieEpsilon(loadouts[j].score, target);
    j++
  ) {
    band.push(j)
  }
  return band
}

function poolFits(
  members: SearchMember[],
  picks: number[],
  inventory: Map<string, number>,
): boolean {
  const used = new Map<string, number>()
  for (let i = 0; i < members.length; i++) {
    for (const [id, count] of members[i].usages[picks[i]]) {
      const next = (used.get(id) ?? 0) + count
      if (next > (inventory.get(id) ?? 0)) return false
      used.set(id, next)
    }
  }
  return true
}

/**
 * The tiebreak stage, run on an already-optimal assignment.
 *
 * For each ability item whose beneficiaries are named, tries to move it
 * to a listed beneficiary — swapping only between loadouts of identical
 * score, so the objective score cannot change. Both the giving and the
 * receiving member must have an equal-scoring alternative and the pool
 * must still add up; otherwise nothing moves. Every scan is capped, so
 * this stays cheap no matter how many loadouts tie.
 */
export function improveBeneficiaryFit(
  members: SearchMember[],
  picks: number[],
  inventory: Map<string, number>,
): number[] {
  const current = [...picks]
  const holds = (i: number, itemId: string) =>
    (members[i].usages[current[i]].get(itemId) ?? 0) > 0

  const annotated = new Map<string, string[]>()
  for (const member of members) {
    for (const loadout of member.loadouts) {
      for (const item of [loadout.weapon, ...loadout.armor]) {
        const list = item.ability?.beneficiaries
        if (list && list.length > 0 && !annotated.has(item.id)) {
          annotated.set(item.id, list)
        }
      }
    }
  }

  for (const [itemId, beneficiaries] of annotated) {
    const holder = members.findIndex((_, i) => holds(i, itemId))
    if (holder !== -1 && beneficiaries.includes(members[holder].character.id)) {
      continue // already where it should be
    }

    for (let c = 0; c < members.length; c++) {
      if (!beneficiaries.includes(members[c].character.id)) continue
      if (c === holder) continue

      const wants = tieBand(members[c].loadouts, current[c]).filter((j) =>
        (members[c].usages[j].get(itemId) ?? 0) > 0,
      )
      if (wants.length === 0) continue

      // If someone else holds it, they need an equal-scoring loadout without it.
      const gives =
        holder === -1
          ? []
          : tieBand(members[holder].loadouts, current[holder]).filter(
              (j) => (members[holder].usages[j].get(itemId) ?? 0) === 0,
            )
      if (holder !== -1 && gives.length === 0) continue

      let moved = false
      for (const jc of wants) {
        const candidate = [...current]
        candidate[c] = jc
        if (holder === -1) {
          if (poolFits(members, candidate, inventory)) {
            current[c] = jc
            moved = true
            break
          }
          continue
        }
        for (const ja of gives) {
          candidate[holder] = ja
          if (poolFits(members, candidate, inventory)) {
            current[c] = jc
            current[holder] = ja
            moved = true
            break
          }
        }
        if (moved) break
      }
      if (moved) break
    }
  }

  return current
}

export function optimizeParty(input: PartyOptimizeInput): PartyOptimizeResult {
  const { party, items, weights, objective, chaptersEnabled, inventoryMode } =
    input

  if (party.length === 0) {
    return { ok: false, reason: "No active party members selected." }
  }

  // Members the pool can't equip at all become per-slot messages
  // instead of failing the whole party result.
  const blocked: BlockedMember[] = []
  const equippableParty: Character[] = []
  for (const character of party) {
    const eligible = items.filter((it) =>
      isCandidateFor(it, character, chaptersEnabled, inventoryMode),
    )
    if (!eligible.some((it) => it.type === "weapon")) {
      blocked.push({
        character,
        reason: `No available weapon for ${character.name} — check owned counts, chapter filter, and exclusions.`,
      })
      continue
    }
    if (
      !character.armorRemovable &&
      !eligible.some((it) => it.type === "armor")
    ) {
      blocked.push({
        character,
        reason: `${character.name} cannot unequip armor, but no armor is available — check owned counts, chapter filter, and exclusions.`,
      })
      continue
    }
    equippableParty.push(character)
  }

  if (equippableParty.length === 0) {
    return {
      ok: true,
      assignments: [],
      blocked,
      objectiveScore: 0,
      leftovers: items
        .filter((it) => it.owned > 0)
        .map((it) => ({ item: it, unused: it.owned })),
    }
  }

  const memberLoadouts = equippableParty.map((character) => ({
    character,
    loadouts: enumerateMemberLoadouts(
      character,
      items,
      weights,
      chaptersEnabled,
      inventoryMode,
    ),
  }))

  // The tiebreak stage only earns its search cost when some reachable
  // item actually names beneficiaries; otherwise the search runs exactly
  // as it did before.
  const tiebreakInPlay = memberLoadouts.some(({ loadouts }) =>
    loadouts.some((l) =>
      [l.weapon, ...l.armor].some(
        (it) => (it.ability?.beneficiaries ?? []).length > 0,
      ),
    ),
  )

  let assignments: Omit<MemberAssignment, "itemNotes" | "memberNotes">[]
  /** Members whose pick the beneficiary tiebreak actually moved. */
  const movedByTiebreak = new Set<string>()

  if (inventoryMode === "unlimited") {
    // No shared pool: each member independently takes their best. Loadouts
    // are already tie-ordered by beneficiary fit, so [0] respects it.
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

    // Tiebreak stage: equal-score swaps only, so the objective score is
    // untouched. Members whose pick it moved get to say so in their notes.
    let picks = solution.picks
    if (tiebreakInPlay) {
      picks = improveBeneficiaryFit(ordered, solution.picks, inventory)
      ordered.forEach((m, i) => {
        if (picks[i] !== solution.picks[i]) movedByTiebreak.add(m.character.id)
      })
    }

    const byId = new Map(
      ordered.map((m, i) => [
        m.character.id,
        { character: m.character, ...m.loadouts[picks[i]] },
      ]),
    )
    // Restore the caller's party order.
    assignments = equippableParty.map(
      (c) =>
        byId.get(c.id) as Omit<MemberAssignment, "itemNotes" | "memberNotes">,
    )
  }

  const nameOf = (id: string) =>
    party.find((c) => c.id === id)?.name ?? id

  const explained: MemberAssignment[] = assignments.map((a) => {
    const itemNotes: ItemNote[] = []
    for (const item of [a.weapon, ...a.armor]) {
      const list = item.ability?.beneficiaries ?? []
      if (list.length === 0) continue
      const abilityName = item.ability?.name
      const ability = abilityName ? `its ${abilityName} ability` : "its ability"
      if (list.includes(a.character.id)) {
        itemNotes.push({
          itemId: item.id,
          text: movedByTiebreak.has(a.character.id)
            ? `${item.name} went to ${a.character.name} — ${ability} benefits them, and the stat score came out identical either way.`
            : `${ability} benefits ${a.character.name}.`,
        })
      } else {
        itemNotes.push({
          itemId: item.id,
          text: `${ability} only benefits ${list.map(nameOf).join(", ")} — ${a.character.name} is holding it because no equal-scoring alternative was free.`,
        })
      }
    }

    // A stat the objective asks for but this character zeroes out is the
    // kind of thing that silently reshapes a result, so say it plainly.
    const zeroed = STAT_KEYS.filter(
      (s) => weights[s] !== 0 && a.character.statWeights[s] === 0,
    )
    const memberNotes =
      zeroed.length > 0
        ? [
            `${zeroed.map((s) => s.toUpperCase()).join(", ")} ${zeroed.length === 1 ? "is" : "are"} weighted 0 for ${a.character.name}, so ${zeroed.length === 1 ? "it" : "they"} contributed nothing to this pick.`,
          ]
        : []

    return { ...a, itemNotes, memberNotes }
  })

  const objectiveScore =
    objective === "sum"
      ? explained.reduce((acc, a) => acc + a.score, 0)
      : Math.min(...explained.map((a) => a.score))

  const used = new Map<string, number>()
  for (const a of explained) {
    for (const [id, count] of loadoutUsage(a)) {
      used.set(id, (used.get(id) ?? 0) + count)
    }
  }
  const leftovers: LeftoverItem[] = items
    .filter((it) => it.owned > 0)
    .map((it) => ({ item: it, unused: it.owned - (used.get(it.id) ?? 0) }))
    .filter(({ unused }) => unused > 0)

  return {
    ok: true,
    assignments: explained,
    blocked,
    objectiveScore,
    leftovers,
  }
}
