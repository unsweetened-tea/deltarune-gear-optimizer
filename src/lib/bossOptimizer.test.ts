import { describe, expect, it } from "vitest"
import type { Boss, Character, Item } from "../types/data"
import {
  damageMultiplierFor,
  optimizeVsBoss,
  totalResistances,
} from "./bossOptimizer"

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

function makeBoss(overrides: Partial<Boss> & { id: string }): Boss {
  return {
    name: overrides.id,
    chapter: 1,
    damageProfile: { neutral: 1 },
    winCondition: "fight",
    ...overrides,
  }
}

const CHAPTERS = [1, 2, 3, 4, 5]

describe("resistance math", () => {
  it("stacks additively across armor pieces and caps at 100", () => {
    const a = makeItem({
      id: "a",
      type: "armor",
      resistances: [{ element: "puppetCat", percent: 40 }],
    })
    const b = makeItem({
      id: "b",
      type: "armor",
      resistances: [{ element: "puppetCat", percent: 35 }],
    })
    const c = makeItem({
      id: "c",
      type: "armor",
      resistances: [{ element: "puppetCat", percent: 80 }],
    })
    expect(totalResistances([a, b], 1).puppetCat).toBe(75)
    expect(totalResistances([a, c], 1).puppetCat).toBe(100) // 120 capped
  })

  it("resolves chapterOverrides against the boss's chapter", () => {
    const mannequin = makeItem({
      id: "mannequin",
      type: "armor",
      resistances: [
        { element: "puppetCat", percent: 35, chapterOverrides: { 5: 20 } },
      ],
    })
    expect(totalResistances([mannequin], 1).puppetCat).toBe(35)
    expect(totalResistances([mannequin], 5).puppetCat).toBe(20)
  })

  it('applies element "all" to every non-neutral element but not neutral', () => {
    const charm = makeItem({
      id: "charm",
      type: "armor",
      resistances: [{ element: "all", percent: 10 }],
    })
    const resist = totalResistances([charm], 1)
    expect(resist.puppetCat).toBe(10)
    expect(resist.darkStar).toBe(10)
    expect(resist.elecHoly).toBe(10)
    expect(resist.deathScythe).toBe(10)

    const boss = makeBoss({
      id: "pink",
      damageProfile: { puppetCat: 0.5, neutral: 0.5 },
    })
    // 0.5 × 0.9 + 0.5 × 1 — neutral share is never reduced.
    expect(damageMultiplierFor([charm], boss)).toBeCloseTo(0.95)
  })

  it("computes the profile-weighted multiplier", () => {
    const dealmaker = makeItem({
      id: "dealmaker",
      type: "armor",
      resistances: [{ element: "puppetCat", percent: 40 }],
    })
    const pink = makeBoss({
      id: "pink",
      damageProfile: { puppetCat: 0.7, neutral: 0.3 },
    })
    // 0.7 × 0.6 + 0.3 = 0.72
    expect(damageMultiplierFor([dealmaker], pink)).toBeCloseTo(0.72)
  })
})

describe("the crux: resistance is not a DEF substitute", () => {
  const kris = makeCharacter({ id: "kris" })
  const sword = makeItem({ id: "sword", type: "weapon" })
  // Low-stat resist item vs high-DEF plain item.
  const mannequin = makeItem({
    id: "mannequin",
    type: "armor",
    stats: { hp: 0, atk: 0, def: 1, magic: 0 },
    resistances: [
      { element: "puppetCat", percent: 35, chapterOverrides: { 5: 20 } },
    ],
  })
  const steelPlate = makeItem({
    id: "steel-plate",
    type: "armor",
    stats: { hp: 0, atk: 0, def: 6, magic: 0 },
  })

  function bestArmorFor(boss: Boss): string[] {
    const result = optimizeVsBoss({
      boss,
      party: [kris],
      items: [sword, mannequin, steelPlate],
      chaptersEnabled: CHAPTERS,
      inventoryMode: "owned",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return []
    return result.assignments[0].armor.map((a) => a.id)
  }

  it("prefers the resist item when the boss's damage is mostly that element", () => {
    const pinkHeavy = makeBoss({
      id: "pink",
      damageProfile: { puppetCat: 0.7, neutral: 0.3 },
    })
    // Both fit (2 slots), but with only 1 slot the choice is forced:
    const oneSlotKris = makeCharacter({
      id: "kris",
      slots: { weapon: 1, armor: 1 },
    })
    const result = optimizeVsBoss({
      boss: pinkHeavy,
      party: [oneSlotKris],
      items: [sword, mannequin, steelPlate],
      chaptersEnabled: CHAPTERS,
      inventoryMode: "owned",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.assignments[0].armor.map((a) => a.id)).toEqual([
        "mannequin",
      ])
    }
  })

  it("prefers the high-DEF item when the non-matching share dominates", () => {
    const pinkLight = makeBoss({
      id: "pink",
      damageProfile: { puppetCat: 0.15, neutral: 0.85 },
    })
    const oneSlotKris = makeCharacter({
      id: "kris",
      slots: { weapon: 1, armor: 1 },
    })
    const result = optimizeVsBoss({
      boss: pinkLight,
      party: [oneSlotKris],
      items: [sword, mannequin, steelPlate],
      chaptersEnabled: CHAPTERS,
      inventoryMode: "owned",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.assignments[0].armor.map((a) => a.id)).toEqual([
        "steel-plate",
      ])
      // And the rejected-item verdict explains the trap.
      const verdict = result.verdicts.find((v) => v.item.id === "mannequin")
      expect(verdict?.used).toBe(false)
      expect(verdict?.reasons.join(" ")).toMatch(/resists the right element/)
    }
  })

  it("weakens the resist item's chapter-5 override", () => {
    // Same heavy profile, but chapter 5: Mannequin drops 35% → 20%.
    const boss = makeBoss({
      id: "pink-ch5",
      chapter: 5,
      damageProfile: { puppetCat: 0.7, neutral: 0.3 },
    })
    expect(damageMultiplierFor([mannequin], boss)).toBeCloseTo(
      0.7 * 0.8 + 0.3,
    )
  })

  it("uses both slots when available", () => {
    const pinkHeavy = makeBoss({
      id: "pink",
      damageProfile: { puppetCat: 0.7, neutral: 0.3 },
    })
    expect(bestArmorFor(pinkHeavy).sort()).toEqual([
      "mannequin",
      "steel-plate",
    ])
  })
})

describe("win condition", () => {
  const kris = makeCharacter({ id: "kris", slots: { weapon: 1, armor: 1 } })
  const sword = makeItem({ id: "sword", type: "weapon" })
  const guardAmulet = makeItem({
    id: "guard-amulet",
    type: "armor",
    stats: { hp: 0, atk: 0, def: 2, magic: 0 },
  })

  it("lets ATK break ties in a fight, but never under spare/special", () => {
    // def 1 vs def 2: per-hit 97 vs 94 → guard amulet wins on threat
    // alone; the ATK bonus (8 × 0.01 threat units) must NOT outweigh
    // real survivability differences at this scale... so use equal DEF
    // to isolate the tiebreak.
    const equalDefAtk = makeItem({
      id: "equal-atk",
      type: "armor",
      stats: { hp: 0, atk: 8, def: 2, magic: 0 },
    })
    const fight = makeBoss({ id: "b1", winCondition: "fight" })
    const spare = makeBoss({ id: "b2", winCondition: "spare" })

    const fightResult = optimizeVsBoss({
      boss: fight,
      party: [kris],
      items: [sword, equalDefAtk, guardAmulet],
      chaptersEnabled: CHAPTERS,
      inventoryMode: "owned",
    })
    expect(fightResult.ok && fightResult.assignments[0].armor[0].id).toBe(
      "equal-atk",
    )

    // Under spare, ATK is worth exactly 0 — with equal survivability
    // the two are tied, so verify via scores: give the ATK item worse
    // DEF and confirm it's never picked even with huge ATK.
    const bigAtkWorseDef = makeItem({
      id: "big-atk",
      type: "armor",
      stats: { hp: 0, atk: 99, def: 1, magic: 0 },
    })
    const spareResult = optimizeVsBoss({
      boss: spare,
      party: [kris],
      items: [sword, bigAtkWorseDef, guardAmulet],
      chaptersEnabled: CHAPTERS,
      inventoryMode: "owned",
    })
    expect(spareResult.ok && spareResult.assignments[0].armor[0].id).toBe(
      "guard-amulet",
    )
  })
})

describe("special rules", () => {
  const kris = makeCharacter({ id: "kris", slots: { weapon: 1, armor: 1 } })
  const susie = makeCharacter({
    id: "susie",
    slots: { weapon: 1, armor: 1 },
    armorRemovable: false,
  })
  const swordA = makeItem({ id: "sword-a", type: "weapon" })
  const swordB = makeItem({ id: "sword-b", type: "weapon" })
  const shadowMantle = makeItem({
    id: "shadow-mantle",
    name: "Shadow Mantle",
    type: "armor",
    stats: { hp: 0, atk: 0, def: 1, magic: 0 },
    owned: 1,
  })
  const ironShield = makeItem({
    id: "iron-shield",
    type: "armor",
    stats: { hp: 0, atk: 0, def: 4, magic: 0 },
    owned: 2,
  })

  it("honors an any-character rule (Titan)", () => {
    const titan = makeBoss({
      id: "titan",
      name: "Titan",
      specialRules: [{ itemName: "Shadow Mantle", flatReduction: 0.5 }],
    })
    const result = optimizeVsBoss({
      boss: titan,
      party: [kris],
      items: [swordA, shadowMantle, ironShield],
      chaptersEnabled: CHAPTERS,
      inventoryMode: "owned",
    })
    // Mantle: 97 × 0.5 = 48.5 vs shield: 88 → mantle wins despite low DEF.
    expect(result.ok && result.assignments[0].armor[0].id).toBe(
      "shadow-mantle",
    )
    if (result.ok) {
      expect(result.assignments[0].damageMultiplier).toBeCloseTo(0.5)
    }
  })

  it("honors the required character (Hammer of Justice: Susie only)", () => {
    const hammer = makeBoss({
      id: "hammer",
      name: "Hammer of Justice",
      specialRules: [
        {
          itemName: "Shadow Mantle",
          requiredCharacterId: "susie",
          flatReduction: 0.85,
        },
      ],
    })
    const result = optimizeVsBoss({
      boss: hammer,
      party: [kris, susie],
      items: [swordA, swordB, shadowMantle, ironShield],
      chaptersEnabled: CHAPTERS,
      inventoryMode: "owned",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      const susieResult = result.assignments.find(
        (a) => a.character.id === "susie",
      )
      const krisResult = result.assignments.find(
        (a) => a.character.id === "kris",
      )
      // The single mantle must go to Susie — on Kris it's just a bad shield.
      expect(susieResult?.armor[0].id).toBe("shadow-mantle")
      expect(susieResult?.damageMultiplier).toBeCloseTo(0.15)
      expect(krisResult?.armor[0].id).toBe("iron-shield")
      expect(krisResult?.damageMultiplier).toBeCloseTo(1)
    }
  })
})

describe("shared pool with boss scoring", () => {
  it("gives a single resist item to only one member", () => {
    const kris = makeCharacter({ id: "kris", slots: { weapon: 1, armor: 1 } })
    const ralsei = makeCharacter({
      id: "ralsei",
      slots: { weapon: 1, armor: 1 },
    })
    const swordA = makeItem({ id: "sword-a", type: "weapon" })
    const swordB = makeItem({ id: "sword-b", type: "weapon" })
    const dealmaker = makeItem({
      id: "dealmaker",
      type: "armor",
      resistances: [{ element: "puppetCat", percent: 40 }],
      owned: 1,
    })
    const plain = makeItem({
      id: "plain",
      type: "armor",
      stats: { hp: 0, atk: 0, def: 1, magic: 0 },
      owned: 2,
    })
    const pink = makeBoss({
      id: "pink",
      damageProfile: { puppetCat: 0.7, neutral: 0.3 },
    })
    const result = optimizeVsBoss({
      boss: pink,
      party: [kris, ralsei],
      items: [swordA, swordB, dealmaker, plain],
      chaptersEnabled: CHAPTERS,
      inventoryMode: "owned",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      const wearers = result.assignments.filter((a) =>
        a.armor.some((p) => p.id === "dealmaker"),
      )
      expect(wearers).toHaveLength(1)
    }
  })
})
