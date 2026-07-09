import type {
  Ability,
  Character,
  Dataset,
  Item,
  Stats,
} from "../types/data"

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

export function isDataset(value: unknown): value is Dataset {
  if (!isRecord(value)) return false
  return (
    typeof value.version === "number" &&
    Array.isArray(value.characters) &&
    value.characters.every(isCharacter) &&
    Array.isArray(value.items) &&
    value.items.every(isItem) &&
    isRecord(value.settings) &&
    Array.isArray(value.settings.chaptersEnabled) &&
    value.settings.chaptersEnabled.every((c) => typeof c === "number") &&
    (value.settings.inventoryMode === "owned" ||
      value.settings.inventoryMode === "unlimited")
  )
}
