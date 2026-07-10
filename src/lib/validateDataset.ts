import type {
  Ability,
  Character,
  Dataset,
  DatasetSettings,
  Item,
  Preset,
  Stats,
} from "../types/data"
import { DATASET_VERSION, ensureBuiltinPresets } from "./presets"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStats(value: unknown): value is Stats {
  return (
    isRecord(value) &&
    typeof value.hp === "number" &&
    typeof value.atk === "number" &&
    typeof value.def === "number" &&
    typeof value.magic === "number"
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
}

function isAbility(value: unknown): value is Ability {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.description === "string"
  )
}

function isItem(value: unknown): value is Item {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.type === "weapon" || value.type === "armor") &&
    typeof value.chapter === "number" &&
    [1, 2, 3, 4, 5].includes(value.chapter) &&
    isStats(value.stats) &&
    (value.equippableBy === "all" || isStringArray(value.equippableBy)) &&
    isStringArray(value.excludedFrom) &&
    (value.ability === undefined || isAbility(value.ability)) &&
    typeof value.owned === "number" &&
    (value.source === undefined || typeof value.source === "string")
  )
}

function isCharacter(value: unknown): value is Character {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isStats(value.baseStats) &&
    (value.level === null || typeof value.level === "number") &&
    isRecord(value.slots) &&
    typeof value.slots.weapon === "number" &&
    typeof value.slots.armor === "number" &&
    typeof value.armorRemovable === "boolean" &&
    typeof value.active === "boolean"
  )
}

function isPreset(value: unknown): value is Preset {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    (value.category === "playstyle" ||
      value.category === "stat" ||
      value.category === "boss") &&
    isStats(value.weights) &&
    (value.objective === "weightedSum" || value.objective === "maximin") &&
    (value.notes === undefined || typeof value.notes === "string")
  )
}

function isSettings(value: unknown): value is DatasetSettings {
  return (
    isRecord(value) &&
    Array.isArray(value.chaptersEnabled) &&
    value.chaptersEnabled.every((c: unknown) => typeof c === "number") &&
    (value.inventoryMode === "owned" || value.inventoryMode === "unlimited")
  )
}

/**
 * Structurally validates stored or imported data and returns a
 * normalized current-version Dataset, or null if the shape is wrong.
 * Pre-preset (version 1) data is accepted and migrated: missing
 * `presets` becomes the built-in set, and missing built-ins are
 * re-added to older exports without touching user presets.
 */
export function parseDataset(value: unknown): Dataset | null {
  if (!isRecord(value)) return null
  if (typeof value.version !== "number") return null
  if (!Array.isArray(value.characters) || !value.characters.every(isCharacter))
    return null
  if (!Array.isArray(value.items) || !value.items.every(isItem)) return null
  if (!isSettings(value.settings)) return null

  let presets: Preset[]
  if (value.presets === undefined) {
    presets = []
  } else if (
    Array.isArray(value.presets) &&
    value.presets.every(isPreset)
  ) {
    presets = value.presets
  } else {
    return null
  }

  return {
    version: DATASET_VERSION,
    characters: value.characters,
    items: value.items,
    presets: ensureBuiltinPresets(presets),
    settings: value.settings,
  }
}
