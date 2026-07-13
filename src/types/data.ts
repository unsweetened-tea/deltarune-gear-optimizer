export interface Stats {
  hp: number
  atk: number
  def: number
  magic: number
}

export interface Ability {
  name: string
  description: string
}

export type ItemType = "weapon" | "armor"

export type Element =
  | "puppetCat"
  | "darkStar"
  | "elecHoly"
  | "deathScythe"
  | "all"

export interface Resistance {
  element: Element
  percent: number
  /** Chapter-dependent values, keyed by the boss's chapter (e.g. Mannequin: 35, but { 5: 20 }). */
  chapterOverrides?: Record<number, number>
}

export interface Item {
  id: string
  name: string
  type: ItemType
  chapter: 1 | 2 | 3 | 4 | 5
  stats: Stats
  equippableBy: "all" | string[]
  excludedFrom: string[]
  ability?: Ability
  /** How many copies you have. Distinct from excludeFromOptimizer: owned is "do I have it right now". */
  owned: number
  source?: string
  resistances?: Resistance[]
  /** Never a candidate in ANY optimizer, regardless of owned — for joke/unused gear that breaks the math. */
  excludeFromOptimizer?: boolean
}

export interface CharacterSlots {
  weapon: number
  armor: number
}

export interface Character {
  id: string
  name: string
  baseStats: Stats
  level: number | null
  slots: CharacterSlots
  armorRemovable: boolean
  active: boolean
}

export type InventoryMode = "owned" | "unlimited"

export type PresetCategory = "playstyle" | "stat" | "boss"

export type PresetObjective = "weightedSum" | "maximin"

export interface Preset {
  id: string
  label: string
  category: PresetCategory
  weights: Stats
  objective: PresetObjective
  notes?: string
}

export interface DatasetSettings {
  chaptersEnabled: number[]
  inventoryMode: InventoryMode
}

export type WinCondition = "fight" | "spare" | "special"

/** An attack that bypasses the element system: a named item grants a flat reduction, optionally only on one character. */
export interface BossSpecialRule {
  itemName: string
  requiredCharacterId?: string
  /** Fraction of damage removed, 0–1 (e.g. 0.5 = halves damage). */
  flatReduction: number
}

export interface Boss {
  id: string
  name: string
  chapter: number
  /** Share of the boss's incoming damage carried by each element; "neutral" is unresisted. Should sum to ~1. */
  damageProfile: Partial<Record<Element | "neutral", number>>
  winCondition: WinCondition
  specialRules?: BossSpecialRule[]
  notes?: string
}

export interface Dataset {
  version: number
  characters: Character[]
  items: Item[]
  presets: Preset[]
  bosses: Boss[]
  settings: DatasetSettings
}
