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

describe("v4 migration: stat weights and chapter gates", () => {
  it("gives pre-v4 characters a neutral weight of 1 for every stat", () => {
    const result = parseDataset(v1Dataset)
    expect(result?.characters[0].statWeights).toEqual({
      hp: 1,
      atk: 1,
      def: 1,
      magic: 1,
    })
  })

  it("keeps stat weights the user already set", () => {
    const weights = { hp: 0, atk: 2, def: 1, magic: 0 }
    const result = parseDataset({
      ...v1Dataset,
      characters: [{ ...v1Dataset.characters[0], statWeights: weights }],
    })
    expect(result?.characters[0].statWeights).toEqual(weights)
  })

  it("seeds the ribbon chapter gates when migrating, not on current data", () => {
    const ribbon = {
      id: "monarchrbn",
      name: "MonarchRBN",
      type: "armor",
      chapter: 5,
      stats: { hp: 0, atk: 0, def: 1, magic: 0 },
      equippableBy: "all",
      excludedFrom: [],
      owned: 1,
    }

    const migrated = parseDataset({ ...v1Dataset, items: [ribbon] })
    const gate = migrated?.items[0].chapterGates?.[0]
    expect(gate?.characterIds).toEqual(["susie"])
    expect(gate?.fromChapter).toBe(5)

    // Already on v4: the user's own edit (here, no gates) is authoritative.
    const current = parseDataset({
      ...v1Dataset,
      version: DATASET_VERSION,
      items: [ribbon],
    })
    expect(current?.items[0].chapterGates).toBeUndefined()
  })

  it("round-trips beneficiaries and gates through export/import", () => {
    const dataset = {
      ...v1Dataset,
      version: DATASET_VERSION,
      characters: [
        {
          ...v1Dataset.characters[0],
          statWeights: { hp: 3, atk: 0, def: 1, magic: 1 },
        },
      ],
      items: [
        {
          ...v1Dataset.items[0],
          ability: {
            name: "HasAntenna",
            description: "Healing up.",
            beneficiaries: ["ralsei"],
          },
          chapterGates: [
            { characterIds: ["susie"], fromChapter: 5, note: "Ch5 only" },
          ],
        },
      ],
    }
    const round = parseDataset(JSON.parse(JSON.stringify(dataset)))
    expect(round?.items[0].ability?.beneficiaries).toEqual(["ralsei"])
    expect(round?.items[0].chapterGates).toEqual(dataset.items[0].chapterGates)
    expect(round?.characters[0].statWeights).toEqual({
      hp: 3,
      atk: 0,
      def: 1,
      magic: 1,
    })
  })

  it("rejects a malformed beneficiaries list rather than guessing", () => {
    expect(
      parseDataset({
        ...v1Dataset,
        items: [
          {
            ...v1Dataset.items[0],
            ability: { name: "x", description: "y", beneficiaries: [1, 2] },
          },
        ],
      }),
    ).toBeNull()
  })
})

describe("bundled seed dataset (src/data/gearData.json)", () => {
  it("parses, migrates, and keeps every item including unknown-chapter ones", async () => {
    const { default: gearData } = await import("../data/gearData.json")
    const seed = parseDataset(gearData)
    expect(seed).not.toBeNull()
    if (!seed) return
    expect(seed.version).toBe(DATASET_VERSION)
    expect(seed.characters.map((c) => c.id)).toEqual([
      "kris",
      "susie",
      "ralsei",
      "noelle",
    ])
    expect(seed.items).toHaveLength(gearData.items.length)
    // Unknown chapters survive as null instead of being rejected.
    expect(seed.items.some((it) => it.chapter === null)).toBe(true)
    // Migration seeds the built-in presets and an empty boss list.
    expect(seed.presets.length).toBeGreaterThan(0)
    expect(seed.bosses).toEqual([])
  })

  it("yields the expected optimizer pool: owned >= 1 and not excluded", async () => {
    const { default: gearData } = await import("../data/gearData.json")
    const { isAvailable } = await import("./optimizer")
    const seed = parseDataset(gearData)
    expect(seed).not.toBeNull()
    if (!seed) return
    const pool = seed.items.filter((it) =>
      isAvailable(it, [1, 2, 3, 4, 5], "owned"),
    )
    const expected = seed.items.filter(
      (it) => it.owned >= 1 && it.excludeFromOptimizer !== true,
    )
    expect(pool.map((i) => i.id).sort()).toEqual(
      expected.map((i) => i.id).sort(),
    )
    expect(pool.length).toBeGreaterThan(0)
    // Unknown-chapter items pass even a narrowed chapter filter.
    const narrowed = seed.items.filter((it) => isAvailable(it, [2], "owned"))
    for (const it of narrowed) {
      expect(it.chapter === null || it.chapter === 2).toBe(true)
    }
  })
})
