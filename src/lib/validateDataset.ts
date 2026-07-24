import type {
  Ability,
  Boss,
  BossSpecialRule,
  ChapterGate,
  Character,
  Dataset,
  DatasetSettings,
  Item,
  MoneySettings,
  Preset,
  Resistance,
  Stats,
} from "../types/data"
import { DEFAULT_MONEY_SETTINGS } from "./money"
import { DATASET_VERSION, ensureBuiltinPresets } from "./presets"
import { applySeedChapterGates } from "./seedChapterGates"

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
    typeof value.description === "string" &&
    (value.beneficiaries === undefined || isStringArray(value.beneficiaries))
  )
}

function isChapterGate(value: unknown): value is ChapterGate {
  return (
    isRecord(value) &&
    isStringArray(value.characterIds) &&
    typeof value.fromChapter === "number" &&
    [1, 2, 3, 4, 5].includes(value.fromChapter) &&
    (value.note === undefined || typeof value.note === "string")
  )
}

const ELEMENT_VALUES = [
  "puppetCat",
  "darkStar",
  "elecHoly",
  "deathScythe",
  "all",
]

function isResistance(value: unknown): value is Resistance {
  if (!isRecord(value)) return false
  if (!ELEMENT_VALUES.includes(value.element as string)) return false
  if (typeof value.percent !== "number") return false
  if (value.chapterOverrides !== undefined) {
    if (!isRecord(value.chapterOverrides)) return false
    // JSON round-trips numeric keys as strings; accept both.
    for (const [k, v] of Object.entries(value.chapterOverrides)) {
      if (!/^\d+$/.test(k) || typeof v !== "number") return false
    }
  }
  return true
}

function isItem(value: unknown): value is Item {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.type === "weapon" || value.type === "armor") &&
    (value.chapter === null ||
      (typeof value.chapter === "number" &&
        [1, 2, 3, 4, 5].includes(value.chapter))) &&
    isStats(value.stats) &&
    (value.equippableBy === "all" || isStringArray(value.equippableBy)) &&
    isStringArray(value.excludedFrom) &&
    (value.ability === undefined || isAbility(value.ability)) &&
    typeof value.owned === "number" &&
    (value.source === undefined || typeof value.source === "string") &&
    (value.resistances === undefined ||
      (Array.isArray(value.resistances) &&
        value.resistances.every(isResistance))) &&
    (value.excludeFromOptimizer === undefined ||
      typeof value.excludeFromOptimizer === "boolean") &&
    (value.chapterGates === undefined ||
      (Array.isArray(value.chapterGates) &&
        value.chapterGates.every(isChapterGate))) &&
    (value.moneyModifier === undefined ||
      typeof value.moneyModifier === "number")
  )
}

function isSpecialRule(value: unknown): value is BossSpecialRule {
  if (!isRecord(value)) return false
  return (
    typeof value.itemName === "string" &&
    (value.requiredCharacterId === undefined ||
      typeof value.requiredCharacterId === "string") &&
    typeof value.flatReduction === "number"
  )
}

function isBoss(value: unknown): value is Boss {
  if (!isRecord(value)) return false
  if (typeof value.id !== "string" || typeof value.name !== "string")
    return false
  if (typeof value.chapter !== "number") return false
  if (!isRecord(value.damageProfile)) return false
  for (const [k, v] of Object.entries(value.damageProfile)) {
    if (!ELEMENT_VALUES.includes(k) && k !== "neutral") return false
    if (typeof v !== "number") return false
  }
  return (
    (value.winCondition === "fight" ||
      value.winCondition === "spare" ||
      value.winCondition === "special") &&
    (value.specialRules === undefined ||
      (Array.isArray(value.specialRules) &&
        value.specialRules.every(isSpecialRule))) &&
    (value.notes === undefined || typeof value.notes === "string")
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
    typeof value.active === "boolean" &&
    isStats(value.statWeights)
  )
}

/** Pre-v4 characters have no relevance weights; every stat starts at 1. */
export const DEFAULT_STAT_WEIGHTS: Stats = { hp: 1, atk: 1, def: 1, magic: 1 }

function normalizeRawCharacter(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (isStats(value.statWeights)) return value
  return { ...value, statWeights: { ...DEFAULT_STAT_WEIGHTS } }
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

function isMoneySettings(value: unknown): value is MoneySettings {
  return (
    isRecord(value) &&
    (value.stackMode === "additive" || value.stackMode === "multiplicative") &&
    (value.scope === "wearer-only" || value.scope === "party-wide")
  )
}

function isSettings(value: unknown): value is DatasetSettings {
  return (
    isRecord(value) &&
    Array.isArray(value.chaptersEnabled) &&
    value.chaptersEnabled.every((c: unknown) => typeof c === "number") &&
    (value.inventoryMode === "owned" || value.inventoryMode === "unlimited") &&
    isMoneySettings(value.moneySettings)
  )
}

/** Pre-v5 settings have no money assumption; default to additive + party-wide. */
function normalizeRawSettings(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (isMoneySettings(value.moneySettings)) return value
  return { ...value, moneySettings: { ...DEFAULT_MONEY_SETTINGS } }
}

/**
 * Tolerated input conventions (used by the bundled seed and hand-made
 * files) that normalize to the strict internal shape:
 *   ability: null            -> field omitted
 *   ability: { name: null }  -> name: "" (unnamed passive)
 */
function normalizeRawItem(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (value.ability === null) {
    const rest = { ...value }
    delete rest.ability
    return rest
  }
  if (isRecord(value.ability) && value.ability.name === null) {
    return { ...value, ability: { ...value.ability, name: "" } }
  }
  return value
}

/**
 * Structurally validates stored or imported data and returns a
 * normalized current-version Dataset, or null if the shape is wrong.
 * Older versions are accepted and migrated: missing `presets` (v1)
 * becomes the built-in set (missing built-ins are re-added without
 * touching user presets), missing `bosses` (v1/v2) becomes [], and
 * pre-v4 data gains per-character stat weights of 1 plus the seed
 * chapter gates (both no-ops for behaviour until edited).
 */
export function parseDataset(value: unknown): Dataset | null {
  if (!isRecord(value)) return null
  if (typeof value.version !== "number") return null
  if (!Array.isArray(value.characters)) return null
  const characters = value.characters.map(normalizeRawCharacter)
  if (!characters.every(isCharacter)) return null
  if (!Array.isArray(value.items)) return null
  const rawItems = value.items.map(normalizeRawItem)
  if (!rawItems.every(isItem)) return null
  const items = value.version < 4 ? applySeedChapterGates(rawItems) : rawItems
  const settings = normalizeRawSettings(value.settings)
  if (!isSettings(settings)) return null

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

  let bosses: Boss[]
  if (value.bosses === undefined) {
    bosses = []
  } else if (Array.isArray(value.bosses) && value.bosses.every(isBoss)) {
    bosses = value.bosses
  } else {
    return null
  }

  return {
    version: DATASET_VERSION,
    characters,
    items,
    presets: ensureBuiltinPresets(presets),
    bosses,
    settings,
  }
}
