export interface Stats {
  hp: number
  atk: number
  def: number
  magic: number
}

export interface Ability {
  name: string
  description: string
  /**
   * Character ids the ability actually helps. Absent or empty = helps
   * anyone. Never scored: it only breaks ties between equal loadouts.
   */
  beneficiaries?: string[]
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

/**
 * A story-progress restriction: the listed characters cannot equip the
 * item until the run has reached `fromChapter` (the highest enabled
 * chapter stands in for "how far you are"). Data-driven — the
 * optimizers read this field and know nothing about specific items.
 */
export interface ChapterGate {
  characterIds: string[]
  fromChapter: 1 | 2 | 3 | 4 | 5
  /** Shown verbatim in the UI, e.g. "partway through Chapter 5". */
  note?: string
}

export interface Item {
  id: string
  name: string
  type: ItemType
  /** null = chapter unknown/uncertain — such items pass every chapter filter. */
  chapter: 1 | 2 | 3 | 4 | 5 | null
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
  /** Per-character story gates, e.g. "Susie can't wear ribbons until Ch5". */
  chapterGates?: ChapterGate[]
  /**
   * Percent change to Dark Dollars earned while equipped. Positive is a
   * bonus, negative a penalty, absent/0 no effect. Real data behind what
   * was previously only English in ability.description, so the money mode
   * can read it.
   */
  moneyModifier?: number
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
  /**
   * How much each stat actually matters for this character, multiplied
   * into whatever the objective asks for (character weight × objective
   * weight). 1 = normal, 0 = this stat contributes nothing for them.
   * Defaults to all 1s — the app makes no assumption about who uses what.
   */
  statWeights: Stats
}

export type InventoryMode = "owned" | "unlimited"

/** How multiple money modifiers combine: sum the percents, or compound them. */
export type MoneyStackMode = "additive" | "multiplicative"

/**
 * Whether every equipped money item feeds one shared party bonus
 * ("party-wide"), or only each character's single best money item counts
 * ("wearer-only" — a second money item on the same character does nothing).
 * The real in-game rule is unverified, so this is a changeable assumption.
 */
export type MoneyScope = "wearer-only" | "party-wide"

export interface MoneySettings {
  stackMode: MoneyStackMode
  scope: MoneyScope
}

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
  /** Stacking assumption for money mode. Defaults to additive + party-wide. */
  moneySettings: MoneySettings
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
