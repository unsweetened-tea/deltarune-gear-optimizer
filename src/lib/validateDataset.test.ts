import { describe, expect, it } from "vitest"
import { parseDataset } from "./validateDataset"
import { builtinPresets, DATASET_VERSION } from "./presets"

const v1Dataset = {
  version: 1,
  characters: [
    {
      id: "kris",
      name: "Kris",
      baseStats: { hp: 0, atk: 0, def: 0, magic: 0 },
      level: null,
      slots: { weapon: 1, armor: 2 },
      armorRemovable: true,
      active: true,
    },
  ],
  items: [
    {
      id: "wood-blade",
      name: "Wood Blade",
      type: "weapon",
      chapter: 1,
      stats: { hp: 0, atk: 2, def: 0, magic: 0 },
      equippableBy: "all",
      excludedFrom: [],
      owned: 1,
    },
  ],
  settings: { chaptersEnabled: [1, 2], inventoryMode: "owned" },
}

describe("parseDataset migration", () => {
  it("migrates a pre-preset (v1) dataset by seeding built-in presets", () => {
    const result = parseDataset(v1Dataset)
    expect(result).not.toBeNull()
    expect(result?.version).toBe(DATASET_VERSION)
    expect(result?.characters).toHaveLength(1)
    expect(result?.items).toHaveLength(1)
    expect(result?.presets.map((p) => p.id).sort()).toEqual(
      builtinPresets()
        .map((p) => p.id)
        .sort(),
    )
  })

  it("preserves user boss presets and re-adds missing built-ins", () => {
    const boss = {
      id: "king",
      label: "King",
      category: "boss",
      weights: { hp: 1, atk: 0, def: 3, magic: 0 },
      objective: "maximin",
      notes: "Heavy hitter",
    }
    const result = parseDataset({ ...v1Dataset, presets: [boss] })
    expect(result).not.toBeNull()
    expect(result?.presets.find((p) => p.id === "king")).toEqual(boss)
    for (const builtin of builtinPresets()) {
      expect(result?.presets.some((p) => p.id === builtin.id)).toBe(true)
    }
  })

  it("does not duplicate or overwrite existing built-ins", () => {
    const customizedBalanced = {
      ...builtinPresets()[0],
      weights: { hp: 9, atk: 9, def: 9, magic: 9 },
    }
    const result = parseDataset({
      ...v1Dataset,
      presets: [customizedBalanced],
    })
    const balanced = result?.presets.filter(
      (p) => p.id === "playstyle-balanced",
    )
    expect(balanced).toHaveLength(1)
    expect(balanced?.[0].weights.hp).toBe(9)
  })

  it("migrates v1/v2 data without bosses to an empty boss list", () => {
    const result = parseDataset(v1Dataset)
    expect(result?.bosses).toEqual([])
  })

  it("preserves valid bosses and rejects malformed ones", () => {
    const boss = {
      id: "pink",
      name: "Pink",
      chapter: 3,
      damageProfile: { puppetCat: 0.7, neutral: 0.3 },
      winCondition: "fight",
      specialRules: [{ itemName: "Shadow Mantle", flatReduction: 0.5 }],
    }
    expect(parseDataset({ ...v1Dataset, bosses: [boss] })?.bosses).toEqual([
      boss,
    ])
    expect(
      parseDataset({ ...v1Dataset, bosses: [{ id: "broken" }] }),
    ).toBeNull()
    expect(
      parseDataset({
        ...v1Dataset,
        bosses: [{ ...boss, damageProfile: { fire: 1 } }],
      }),
    ).toBeNull()
  })

  it("rejects malformed presets", () => {
    expect(
      parseDataset({ ...v1Dataset, presets: [{ id: "x" }] }),
    ).toBeNull()
    expect(parseDataset({ ...v1Dataset, presets: "nope" })).toBeNull()
  })

  it("still rejects structurally invalid core data", () => {
    expect(parseDataset(null)).toBeNull()
    expect(parseDataset([1, 2])).toBeNull()
    expect(parseDataset({ ...v1Dataset, items: "nope" })).toBeNull()
    expect(
      parseDataset({
        ...v1Dataset,
        characters: [{ id: "broken" }],
      }),
    ).toBeNull()
  })
})
