import type {
  Character,
  InventoryMode,
  Item,
  Stats,
} from "../types/data"

export interface ScoredLoadout {
  weapon: Item
  armor: Item[]
  totals: Stats
}

/**
 * How far the run has progressed, taken as the highest enabled chapter.
 * Chapter gates are relative to this — there is no separate "current
 * chapter" setting to keep in sync.
 */
export function currentChapter(chaptersEnabled: number[]): number {
  return chaptersEnabled.length === 0 ? 0 : Math.max(...chaptersEnabled)
}

export interface OptimizeInput {
  character: Character
  items: Item[]
  targetStat: keyof Stats
  chaptersEnabled: number[]
  inventoryMode: InventoryMode
}

export type OptimizeResult =
  | { ok: true; loadouts: ScoredLoadout[] }
  | { ok: false; reason: string }

export function canEquip(item: Item, character: Character): boolean {
  if (item.excludedFrom.includes(character.id)) return false
  return (
    item.equippableBy === "all" || item.equippableBy.includes(character.id)
  )
}

/** The gate blocking this character right now, if any. */
export function blockingChapterGate(
  item: Item,
  character: Character,
  chaptersEnabled: number[],
) {
  const reached = currentChapter(chaptersEnabled)
  return (item.chapterGates ?? []).find(
    (gate) =>
      gate.characterIds.includes(character.id) && reached < gate.fromChapter,
  )
}

/** canEquip plus story gates — who may wear this at the current progress. */
export function canEquipNow(
  item: Item,
  character: Character,
  chaptersEnabled: number[],
): boolean {
  if (!canEquip(item, character)) return false
  return blockingChapterGate(item, character, chaptersEnabled) === undefined
}

/**
 * The single gate every optimizer must pass an item through: equip
 * legality, story gates, permanent exclusion, chapter filter and owned
 * count. Nothing should filter candidates by hand.
 */
export function isCandidateFor(
  item: Item,
  character: Character,
  chaptersEnabled: number[],
  inventoryMode: InventoryMode,
): boolean {
  return (
    canEquipNow(item, character, chaptersEnabled) &&
    isAvailable(item, chaptersEnabled, inventoryMode)
  )
}

/**
 * Loadout preference for ability beneficiaries: +1 for each equipped
 * ability item this character is listed on, -1 for each one they hold
 * despite not being listed. Items with no beneficiary list score 0.
 * This is NEVER added to the stat score — it only orders ties.
 */
export function beneficiaryScore(
  character: Character,
  equipped: Item[],
): number {
  let score = 0
  for (const item of equipped) {
    const list = item.ability?.beneficiaries
    if (!list || list.length === 0) continue
    score += list.includes(character.id) ? 1 : -1
  }
  return score
}

export function isAvailable(
  item: Item,
  chaptersEnabled: number[],
  inventoryMode: InventoryMode,
): boolean {
  // Permanent exclusion applies in every mode — even unlimited/theorycraft.
  if (item.excludeFromOptimizer === true) return false
  // Unknown chapter (null) is never filtered out by chapter selection.
  if (item.chapter !== null && !chaptersEnabled.includes(item.chapter))
    return false
  if (inventoryMode === "owned" && item.owned <= 0) return false
  return true
}

function maxCopies(
  item: Item,
  inventoryMode: InventoryMode,
  slots: number,
): number {
  return inventoryMode === "owned" ? Math.min(item.owned, slots) : slots
}

/**
 * All ways to fill 0..slots armor slots from candidates, as unordered
 * selections. Duplicates of one item are allowed only up to its owned
 * count in owned mode (unbounded up to slot count in unlimited mode).
 */
export function enumerateArmorSelections(
  candidates: Item[],
  slots: number,
  inventoryMode: InventoryMode,
): Item[][] {
  const results: Item[][] = []

  function recurse(start: number, current: Item[]) {
    results.push([...current])
    if (current.length >= slots) return
    for (let i = start; i < candidates.length; i++) {
      const item = candidates[i]
      const alreadyUsed = current.filter((it) => it.id === item.id).length
      if (alreadyUsed >= maxCopies(item, inventoryMode, slots)) continue
      current.push(item)
      recurse(i, current)
      current.pop()
    }
  }

  recurse(0, [])
  return results
}

export function totalStats(character: Character, equipped: Item[]): Stats {
  const totals: Stats = { ...character.baseStats }
  for (const item of equipped) {
    totals.hp += item.stats.hp
    totals.atk += item.stats.atk
    totals.def += item.stats.def
    totals.magic += item.stats.magic
  }
  return totals
}

export function optimize(input: OptimizeInput): OptimizeResult {
  const { character, items, targetStat, chaptersEnabled, inventoryMode } =
    input

  const eligible = items.filter((it) =>
    isCandidateFor(it, character, chaptersEnabled, inventoryMode),
  )
  const weapons = eligible.filter((it) => it.type === "weapon")
  const armorCandidates = eligible.filter((it) => it.type === "armor")

  if (weapons.length === 0) {
    return {
      ok: false,
      reason: `No available weapons for ${character.name} with the current filters (check chapter filter, inventory mode, and owned counts).`,
    }
  }

  let armorSelections = enumerateArmorSelections(
    armorCandidates,
    character.slots.armor,
    inventoryMode,
  )
  if (!character.armorRemovable) {
    armorSelections = armorSelections.filter((sel) => sel.length > 0)
    if (armorSelections.length === 0) {
      return {
        ok: false,
        reason: `${character.name} cannot unequip armor, but no armor is available with the current filters.`,
      }
    }
  }

  const loadouts: ScoredLoadout[] = []
  for (const weapon of weapons) {
    for (const armor of armorSelections) {
      loadouts.push({
        weapon,
        armor,
        totals: totalStats(character, [weapon, ...armor]),
      })
    }
  }

  // The character's own relevance weight scales the target stat: at 0 the
  // stat contributes nothing and every loadout ties, which the panel says
  // out loud rather than presenting an arbitrary winner as "best".
  const relevance = character.statWeights[targetStat]
  loadouts.sort((a, b) => {
    const delta =
      b.totals[targetStat] * relevance - a.totals[targetStat] * relevance
    if (delta !== 0) return delta
    // Equal on the stat: prefer the loadout whose ability items are held
    // by a listed beneficiary. Abilities themselves stay unscored.
    return (
      beneficiaryScore(character, [b.weapon, ...b.armor]) -
      beneficiaryScore(character, [a.weapon, ...a.armor])
    )
  })
  return { ok: true, loadouts }
}
