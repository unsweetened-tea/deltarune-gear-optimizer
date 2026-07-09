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

export function isAvailable(
  item: Item,
  chaptersEnabled: number[],
  inventoryMode: InventoryMode,
): boolean {
  if (!chaptersEnabled.includes(item.chapter)) return false
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

  const eligible = items.filter(
    (it) =>
      canEquip(it, character) &&
      isAvailable(it, chaptersEnabled, inventoryMode),
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

  loadouts.sort((a, b) => b.totals[targetStat] - a.totals[targetStat])
  return { ok: true, loadouts }
}
