import type { Dataset, Preset, PresetObjective } from "../types/data"
import type { PartyObjective } from "./partyOptimizer"

export const DATASET_VERSION = 2

export function builtinPresets(): Preset[] {
  return [
    {
      id: "playstyle-balanced",
      label: "Balanced",
      category: "playstyle",
      weights: { hp: 1, atk: 2, def: 1, magic: 2 },
      objective: "maximin",
      notes:
        "Weighs ATK and Magic equally, with some HP/DEF. Magic drives spell and heal effectiveness and is the closest proxy for sparing — sparing itself isn't a modeled mechanic. Uses maximin so no party member is left badly equipped.",
    },
    {
      id: "playstyle-aggressive",
      label: "Aggressive",
      category: "playstyle",
      weights: { hp: 0, atk: 3, def: 1, magic: 0 },
      objective: "weightedSum",
      notes:
        "Maximizes total party damage output. Weighted sum will happily concentrate the best offensive gear on whoever benefits most.",
    },
    {
      id: "playstyle-defensive",
      label: "Defensive",
      category: "playstyle",
      weights: { hp: 2, atk: 0, def: 3, magic: 0 },
      objective: "maximin",
      notes:
        "Prioritizes DEF and HP for survivability. Uses maximin — the party is only as durable as its squishiest member.",
    },
    {
      id: "playstyle-support",
      label: "Support / Spare",
      category: "playstyle",
      weights: { hp: 1, atk: 0, def: 0, magic: 3 },
      objective: "maximin",
      notes:
        "Magic-heavy for spells, healing, and pacify-style options. \"Spare\" is approximated via Magic — it is not a directly modeled mechanic.",
    },
    {
      id: "stat-hp",
      label: "HP",
      category: "stat",
      weights: { hp: 1, atk: 0, def: 0, magic: 0 },
      objective: "weightedSum",
      notes: "Maximizes total party HP; every other stat is ignored.",
    },
    {
      id: "stat-atk",
      label: "ATK",
      category: "stat",
      weights: { hp: 0, atk: 1, def: 0, magic: 0 },
      objective: "weightedSum",
      notes: "Maximizes total party ATK; every other stat is ignored.",
    },
    {
      id: "stat-def",
      label: "DEF",
      category: "stat",
      weights: { hp: 0, atk: 0, def: 1, magic: 0 },
      objective: "weightedSum",
      notes: "Maximizes total party DEF; every other stat is ignored.",
    },
    {
      id: "stat-magic",
      label: "Magic",
      category: "stat",
      weights: { hp: 0, atk: 0, def: 0, magic: 1 },
      objective: "weightedSum",
      notes: "Maximizes total party Magic; every other stat is ignored.",
    },
  ]
}

/**
 * Adds any missing built-in presets (matched by id) without touching
 * user-created or user-selected ones. Lets pre-preset datasets and
 * old exports migrate cleanly.
 */
export function ensureBuiltinPresets(presets: Preset[]): Preset[] {
  const existing = new Set(presets.map((p) => p.id))
  const missing = builtinPresets().filter((p) => !existing.has(p.id))
  return missing.length === 0 ? presets : [...missing, ...presets]
}

export function toPartyObjective(objective: PresetObjective): PartyObjective {
  return objective === "weightedSum" ? "sum" : "maximin"
}

export function bossPresets(dataset: Dataset): Preset[] {
  return dataset.presets.filter((p) => p.category === "boss")
}
