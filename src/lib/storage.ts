import type { Dataset } from "../types/data"
import { createDefaultDataset } from "./defaultDataset"
import { parseDataset } from "./validateDataset"

const STORAGE_KEY = "deltarune-optimizer:dataset"

export function loadDataset(): Dataset {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return createDefaultDataset()

  try {
    return parseDataset(JSON.parse(raw)) ?? createDefaultDataset()
  } catch {
    return createDefaultDataset()
  }
}

export function saveDataset(dataset: Dataset): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset))
}
