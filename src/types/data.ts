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

export interface Item {
  id: string
  name: string
  type: ItemType
  chapter: 1 | 2 | 3 | 4 | 5
  stats: Stats
  equippableBy: "all" | string[]
  excludedFrom: string[]
  ability?: Ability
  owned: number
  source?: string
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

export interface Dataset {
  version: number
  characters: Character[]
  items: Item[]
  presets: Preset[]
  settings: DatasetSettings
}
