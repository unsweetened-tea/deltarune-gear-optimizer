import { describe, expect, it } from "vitest"
import type { Character, Item } from "../types/data"
import {
  blockingChapterGate,
  canEquipNow,
  isCandidateFor,
  optimize,
} from "./optimizer"
import { optimizeParty } from "./partyOptimizer"

function makeCharacter(
  overrides: Partial<Character> & { id: string },
): Character {
  return {
    name: overrides.id,
    baseStats: { hp: 0, atk: 0, def: 0, magic: 0 },
    level: null,
    slots: { weapon: 1, armor: 2 },
    armorRemovable: true,
    active: true,
    statWeights: { hp: 1, atk: 1, def: 1, magic: 1 },
    ...overrides,
  }
}

function makeItem(
  overrides: Partial<Item> & { id: string; type: Item["type"] },
): Item {
  return {
    name: overrides.id,
    chapter: 1,
    stats: { hp: 0, atk: 0, def: 0, magic: 0 },
    equippableBy: "all",
    excludedFrom: [],
    owned: 1,
    ...overrides,
  }
}

const ALL_CHAPTERS = [1, 2, 3, 4, 5]
const UNIT_WEIGHTS = { hp: 1, atk: 1, def: 1, magic: 1 }

/** Every item the party result actually equips, member by member. */
function equippedByMember(
  party: Character[],
  items: Item[],
  chaptersEnabled = ALL_CHAPTERS,
): Map<string, Item[]> {
  const result = optimizeParty({
    party,
    items,
    weights: UNIT_WEIGHTS,
    objective: "sum",
    chaptersEnabled,
    inventoryMode: "owned",
  })
  if (!result.ok) throw new Error(`expected a result, got: ${result.reason}`)
  return new Map(
    result.assignments.map((a) => [a.character.id, [a.weapon, ...a.armor]]),
  )
}

describe("equip restrictions are enforced by the optimizers", () => {
  const kris = makeCharacter({ id: "kris" })
  const susie = makeCharacter({ id: "susie", armorRemovable: false })

  it("never puts a character-locked weapon on the wrong character", () => {
    // Kris's sword is far better, so only the lock can keep it off Susie.
    const items = [
      makeItem({
        id: "kris-sword",
        type: "weapon",
        equippableBy: ["kris"],
        stats: { hp: 0, atk: 99, def: 0, magic: 0 },
        owned: 2,
      }),
      makeItem({ id: "plain-weapon", type: "weapon", owned: 2 }),
      makeItem({ id: "plain-armor", type: "armor", owned: 4 }),
    ]
    const equipped = equippedByMember([kris, susie], items)

    expect(equipped.get("kris")?.map((i) => i.id)).toContain("kris-sword")
    expect(equipped.get("susie")?.map((i) => i.id)).not.toContain("kris-sword")
  })

  it("honors excludedFrom even when the item is otherwise best", () => {
    const items = [
      makeItem({ id: "weapon", type: "weapon", owned: 2 }),
      makeItem({
        id: "no-susie-armor",
        type: "armor",
        excludedFrom: ["susie"],
        stats: { hp: 50, atk: 0, def: 0, magic: 0 },
        owned: 4,
      }),
      makeItem({ id: "plain-armor", type: "armor", owned: 4 }),
    ]
    const equipped = equippedByMember([kris, susie], items)

    expect(equipped.get("susie")?.map((i) => i.id)).not.toContain(
      "no-susie-armor",
    )
    expect(equipped.get("kris")?.map((i) => i.id)).toContain("no-susie-armor")
  })

  it("never proposes an excludeFromOptimizer item, in either inventory mode", () => {
    const items = [
      makeItem({ id: "weapon", type: "weapon" }),
      makeItem({
        id: "broken-scarf",
        type: "armor",
        stats: { hp: 999, atk: 999, def: 999, magic: 999 },
        owned: 9,
        excludeFromOptimizer: true,
      }),
      makeItem({ id: "plain-armor", type: "armor", owned: 4 }),
    ]

    for (const inventoryMode of ["owned", "unlimited"] as const) {
      const result = optimizeParty({
        party: [kris],
        items,
        weights: UNIT_WEIGHTS,
        objective: "sum",
        chaptersEnabled: ALL_CHAPTERS,
        inventoryMode,
      })
      if (!result.ok) throw new Error(result.reason)
      const ids = result.assignments.flatMap((a) => [
        a.weapon.id,
        ...a.armor.map((x) => x.id),
      ])
      expect(ids).not.toContain("broken-scarf")
    }

    // …and the solo optimizer agrees.
    const solo = optimize({
      character: kris,
      items,
      targetStat: "hp",
      chaptersEnabled: ALL_CHAPTERS,
      inventoryMode: "unlimited",
    })
    if (!solo.ok) throw new Error(solo.reason)
    const soloIds = solo.loadouts.flatMap((l) => [
      l.weapon.id,
      ...l.armor.map((x) => x.id),
    ])
    expect(soloIds).not.toContain("broken-scarf")
  })

  it("keeps armor on a character who cannot unequip it", () => {
    const items = [
      makeItem({ id: "weapon", type: "weapon", owned: 2 }),
      // Negative armor: leaving the slot empty would score better.
      makeItem({
        id: "cursed-armor",
        type: "armor",
        stats: { hp: -5, atk: -5, def: -5, magic: -5 },
        owned: 4,
      }),
    ]
    const equipped = equippedByMember([kris, susie], items)

    expect(equipped.get("susie")?.filter((i) => i.type === "armor")).toHaveLength(
      1,
    )
    // Kris may (and should) drop it — the rule is Susie's alone.
    expect(equipped.get("kris")?.filter((i) => i.type === "armor")).toHaveLength(
      0,
    )
  })

  it("only offers an item when its chapter is enabled", () => {
    const items = [
      makeItem({ id: "weapon", type: "weapon" }),
      makeItem({
        id: "ch5-armor",
        type: "armor",
        chapter: 5,
        stats: { hp: 20, atk: 0, def: 0, magic: 0 },
      }),
    ]

    expect(
      equippedByMember([kris], items, [1, 2, 3, 4]).get("kris")?.map((i) => i.id),
    ).not.toContain("ch5-armor")
    expect(
      equippedByMember([kris], items, ALL_CHAPTERS).get("kris")?.map((i) => i.id),
    ).toContain("ch5-armor")
  })

  it("treats chapter: null as available in every chapter", () => {
    const unknown = makeItem({
      id: "unknown-chapter",
      type: "armor",
      chapter: null,
      stats: { hp: 20, atk: 0, def: 0, magic: 0 },
    })
    // The weapon is chapter-less too, so the only variable is the armor.
    const items = [
      makeItem({ id: "weapon", type: "weapon", chapter: null }),
      unknown,
    ]

    for (const chapters of [[1], [3], ALL_CHAPTERS, [5]]) {
      expect(
        equippedByMember([kris], items, chapters).get("kris")?.map((i) => i.id),
      ).toContain("unknown-chapter")
    }
    expect(isCandidateFor(unknown, kris, [2], "owned")).toBe(true)
  })
})

describe("per-character chapter gates", () => {
  const kris = makeCharacter({ id: "kris" })
  const susie = makeCharacter({ id: "susie" })
  const ribbon = makeItem({
    id: "ribbon",
    type: "armor",
    chapter: 1,
    stats: { hp: 30, atk: 0, def: 0, magic: 0 },
    owned: 4,
    chapterGates: [
      {
        characterIds: ["susie"],
        fromChapter: 5,
        note: "Susie only wears ribbons partway through Chapter 5",
      },
    ],
  })
  const items = [makeItem({ id: "weapon", type: "weapon", owned: 4 }), ribbon]

  it("blocks the gated character before the chapter is reached", () => {
    expect(canEquipNow(ribbon, susie, [1, 2, 3, 4])).toBe(false)
    expect(blockingChapterGate(ribbon, susie, [1, 2, 3, 4])?.note).toContain(
      "Chapter 5",
    )

    const equipped = equippedByMember([kris, susie], items, [1, 2, 3, 4])
    expect(equipped.get("susie")?.map((i) => i.id)).not.toContain("ribbon")
  })

  it("releases the item once the chapter is reached", () => {
    expect(canEquipNow(ribbon, susie, ALL_CHAPTERS)).toBe(true)
    const equipped = equippedByMember([kris, susie], items, ALL_CHAPTERS)
    expect(equipped.get("susie")?.map((i) => i.id)).toContain("ribbon")
  })

  it("never gates a character the rule doesn't name", () => {
    expect(canEquipNow(ribbon, kris, [1])).toBe(true)
    const equipped = equippedByMember([kris, susie], items, [1, 2, 3, 4])
    expect(equipped.get("kris")?.map((i) => i.id)).toContain("ribbon")
  })
})
