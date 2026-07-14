import type { Dataset } from "../types/data"
import { createDefaultDataset } from "./defaultDataset"
import { parseDataset } from "./validateDataset"
import gearData from "../data/gearData.json"

const STORAGE_KEY = "deltarune-optimizer:dataset"
/** Raw version of the bundled seed the saved data was last initialized/reset from. */
const SEED_VERSION_KEY = "deltarune-optimizer:seed-version"
const SEED_NOTE_DISMISSED_KEY = "deltarune-optimizer:seed-note-dismissed"

/** Raw data version declared by the bundled seed file (independent of schema version). */
export const bundledSeedVersion: number =
  typeof gearData.version === "number" ? gearData.version : 0

/** The bundled seed as a validated, migrated Dataset (null only if the file is malformed). */
export function loadSeedDataset(): Dataset | null {
  return parseDataset(gearData)
}

export function appliedSeedVersion(): number | null {
  const raw = localStorage.getItem(SEED_VERSION_KEY)
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function markSeedApplied(version: number): void {
  localStorage.setItem(SEED_VERSION_KEY, String(version))
}

export function isSeedNoteDismissed(): boolean {
  return (
    localStorage.getItem(SEED_NOTE_DISMISSED_KEY) ===
    String(bundledSeedVersion)
  )
}

export function dismissSeedNote(): void {
  localStorage.setItem(SEED_NOTE_DISMISSED_KEY, String(bundledSeedVersion))
}

export function loadDataset(): Dataset {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    // First run: initialize from the bundled seed, not the empty default.
    const seed = loadSeedDataset()
    if (seed) {
      markSeedApplied(bundledSeedVersion)
      return seed
    }
    return createDefaultDataset()
  }

  // Existing saved data always wins over the seed — never auto-overwrite.
  // Grandfather pre-seed saves: baseline them at the current seed version
  // so the "newer default available" note only fires on future seeds.
  if (appliedSeedVersion() === null) {
    markSeedApplied(bundledSeedVersion)
  }

  try {
    return parseDataset(JSON.parse(raw)) ?? createDefaultDataset()
  } catch {
    return createDefaultDataset()
  }
}

export function saveDataset(dataset: Dataset): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset))
}
