import type { Character, Dataset } from "../types/data"
import { builtinPresets, DATASET_VERSION } from "./presets"

const zeroStats = { hp: 0, atk: 0, def: 0, magic: 0 }

const starterCharacters: Character[] = [
  {
    id: "kris",
    name: "Kris",
    baseStats: { ...zeroStats },
    level: null,
    slots: { weapon: 1, armor: 2 },
    armorRemovable: true,
    active: true,
  },
  {
    id: "susie",
    name: "Susie",
    baseStats: { ...zeroStats },
    level: null,
    slots: { weapon: 1, armor: 2 },
    armorRemovable: false,
    active: true,
  },
  {
    id: "ralsei",
    name: "Ralsei",
    baseStats: { ...zeroStats },
    level: null,
    slots: { weapon: 1, armor: 2 },
    armorRemovable: true,
    active: true,
  },
  {
    id: "noelle",
    name: "Noelle",
    baseStats: { ...zeroStats },
    level: null,
    slots: { weapon: 1, armor: 2 },
    armorRemovable: true,
    active: false,
  },
]

export function createDefaultDataset(): Dataset {
  return {
    version: DATASET_VERSION,
    characters: starterCharacters,
    items: [],
    presets: builtinPresets(),
    bosses: [],
    settings: {
      chaptersEnabled: [1, 2, 3, 4, 5],
      inventoryMode: "owned",
    },
  }
}
