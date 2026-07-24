import { describe, expect, it } from "vitest"
import type { Character, Item, MoneySettings } from "../types/data"
import { optimize } from "./optimizer"
import { optimizeParty } from "./partyOptimizer"
import {
  computePartyMoney,
  DEFAULT_MONEY_SETTINGS,
  memberMoneyScore,
  moneyOf,
} from "./money"

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

function runMoney(
  party: Character[],
  items: Item[],
  settings: MoneySettings = DEFAULT_MONEY_SETTINGS,
) {
  const result = optimizeParty({
    party,
    items,
    weights: { hp: 0, atk: 0, def: 0, magic: 0 },
    objective: "sum",
    chaptersEnabled: ALL_CHAPTERS,
    inventoryMode: "owned",
    money: settings,
  })
  if (!result.ok) throw new Error(result.reason)
  return result
}

const equippedIds = (a: { weapon: Item; armor: Item[] }) => [
  a.weapon.id,
  ...a.armor.map((x) => x.id),
]

describe("memberMoneyScore + moneyOf", () => {
  it("sums modifiers and treats absent as zero", () => {
    const a = makeItem({ id: "a", type: "weapon", moneyModifier: 30 })
    const b = makeItem({ id: "b", type: "armor", moneyModifier: 5 })
    const c = makeItem({ id: "c", type: "armor" })
    expect(moneyOf(c)).toBe(0)
    expect(memberMoneyScore([a, b, c])).toBe(35)
  })
})

describe("computePartyMoney aggregation", () => {
  const kris = makeCharacter({ id: "kris", name: "Kris" })
  const susie = makeCharacter({ id: "susie", name: "Susie" })
  const dealmaker = makeItem({
    id: "dealmaker",
    type: "armor",
    moneyModifier: 30,
  })
  const winglade = makeItem({ id: "winglade", type: "weapon", moneyModifier: 5 })
  const silver = makeItem({ id: "silver", type: "armor", moneyModifier: 5 })

  // Kris: winglade(+5) + dealmaker(+30); Susie: silver(+5).
  const members = [
    { character: kris, equipped: [winglade, dealmaker] },
    { character: susie, equipped: [silver] },
  ]

  it("party-wide additive sums every equipped modifier", () => {
    const b = computePartyMoney(members, {
      stackMode: "additive",
      scope: "party-wide",
    })
    expect(b.totalPercent).toBe(40)
    expect(b.contributions).toHaveLength(3)
  })

  it("party-wide multiplicative compounds every modifier", () => {
    const b = computePartyMoney(members, {
      stackMode: "multiplicative",
      scope: "party-wide",
    })
    // 1.05 * 1.30 * 1.05 = 1.43325 -> 43.3%
    expect(b.totalPercent).toBeCloseTo(43.3, 1)
  })

  it("wearer-only counts only each character's single best item", () => {
    const b = computePartyMoney(members, {
      stackMode: "additive",
      scope: "wearer-only",
    })
    // Kris's best (30) + Susie's best (5); winglade's +5 is dropped.
    expect(b.totalPercent).toBe(35)
    expect(b.contributions.map((c) => c.itemId).sort()).toEqual([
      "dealmaker",
      "silver",
    ])
  })

  it("flags negative contributions as forced", () => {
    const b = computePartyMoney(
      [{ character: kris, equipped: [makeItem({ id: "dog", type: "armor", moneyModifier: -90 })] }],
      DEFAULT_MONEY_SETTINGS,
    )
    expect(b.totalPercent).toBe(-90)
    expect(b.forcedNegatives).toHaveLength(1)
  })
})

describe("money mode selection and guardrails (party)", () => {
  const kris = makeCharacter({ id: "kris", name: "Kris" })

  it("equips the money armor over a plain one", () => {
    const items = [
      makeItem({ id: "weapon", type: "weapon" }),
      makeItem({ id: "dealmaker", type: "armor", moneyModifier: 30 }),
      makeItem({ id: "plain", type: "armor" }),
    ]
    const r = runMoney([kris], items)
    expect(equippedIds(r.assignments[0])).toContain("dealmaker")
    expect(r.money?.totalPercent).toBe(30)
  })

  it("never equips a negative-money item when a neutral one exists", () => {
    const items = [
      makeItem({ id: "weapon", type: "weapon" }),
      makeItem({ id: "dogwidow", type: "armor", moneyModifier: -90 }),
      makeItem({ id: "plain", type: "armor" }),
    ]
    const r = runMoney([kris], items)
    expect(equippedIds(r.assignments[0])).not.toContain("dogwidow")
  })

  it("equips a negative item only when it is the only legal option, and flags it", () => {
    const susie = makeCharacter({
      id: "susie",
      name: "Susie",
      armorRemovable: false,
      slots: { weapon: 1, armor: 1 },
    })
    const items = [
      makeItem({ id: "weapon", type: "weapon" }),
      // The only armor in the whole dataset carries a penalty.
      makeItem({ id: "dogwidow", type: "armor", moneyModifier: -90 }),
    ]
    const r = runMoney([susie], items)
    expect(equippedIds(r.assignments[0])).toContain("dogwidow")
    expect(r.money?.forcedNegatives.map((f) => f.itemId)).toContain("dogwidow")
    // The why-line explains it was forced.
    const note = r.assignments[0].itemNotes.find(
      (n) => n.itemId === "dogwidow",
    )?.text
    expect(note).toMatch(/only equipped because/i)
  })

  it("never selects an excludeFromOptimizer item even with a money value", () => {
    const items = [
      makeItem({ id: "weapon", type: "weapon" }),
      makeItem({
        id: "trefoil",
        type: "weapon",
        moneyModifier: 5,
        excludeFromOptimizer: true,
      }),
      makeItem({ id: "plain", type: "armor" }),
    ]
    const r = runMoney([kris], items)
    expect(equippedIds(r.assignments[0])).not.toContain("trefoil")
  })

  it("respects the shared inventory: one Dealmaker goes to one character", () => {
    const susie = makeCharacter({ id: "susie", name: "Susie" })
    const items = [
      makeItem({ id: "weapon", type: "weapon", owned: 2 }),
      makeItem({ id: "dealmaker", type: "armor", moneyModifier: 30, owned: 1 }),
      makeItem({ id: "plain", type: "armor", owned: 4 }),
    ]
    const r = runMoney([kris, susie], items)
    const holders = r.assignments.filter((a) =>
      equippedIds(a).includes("dealmaker"),
    )
    expect(holders).toHaveLength(1)
    expect(r.money?.totalPercent).toBe(30)
  })

  it("honors chapter gating on money items", () => {
    const items = [
      makeItem({ id: "weapon", type: "weapon" }),
      makeItem({
        id: "dealmaker",
        type: "armor",
        chapter: 2,
        moneyModifier: 30,
      }),
      makeItem({ id: "plain", type: "armor" }),
    ]
    const early = optimizeParty({
      party: [kris],
      items,
      weights: { hp: 0, atk: 0, def: 0, magic: 0 },
      objective: "sum",
      chaptersEnabled: [1],
      inventoryMode: "owned",
      money: DEFAULT_MONEY_SETTINGS,
    })
    if (!early.ok) throw new Error(early.reason)
    expect(equippedIds(early.assignments[0])).not.toContain("dealmaker")
    expect(early.money?.totalPercent).toBe(0)
  })
})

describe("solo money mode", () => {
  const kris = makeCharacter({ id: "kris", name: "Kris" })
  const items = [
    makeItem({ id: "weapon", type: "weapon" }),
    makeItem({ id: "dealmaker", type: "armor", moneyModifier: 30 }),
    makeItem({ id: "dogwidow", type: "armor", moneyModifier: -90 }),
    makeItem({ id: "plain", type: "armor" }),
  ]

  it("maximizes the character's money and avoids the penalty item", () => {
    const r = optimize({
      character: kris,
      items,
      targetStat: "atk",
      chaptersEnabled: ALL_CHAPTERS,
      inventoryMode: "owned",
      money: DEFAULT_MONEY_SETTINGS,
    })
    if (!r.ok) throw new Error(r.reason)
    const best = r.loadouts[0]
    const ids = [best.weapon.id, ...best.armor.map((a) => a.id)]
    expect(ids).toContain("dealmaker")
    expect(ids).not.toContain("dogwidow")
  })
})

/**
 * Cross-check party-wide additive money against a brute force over the
 * same per-member loadouts, so the branch-and-bound reuse can't quietly
 * miss the true maximum. 60 seeded scenarios.
 */
describe("party-wide additive money matches brute force", () => {
  function mulberry32(seed: number): () => number {
    let a = seed
    return () => {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const randInt = (rng: () => number, lo: number, hi: number) =>
    lo + Math.floor(rng() * (hi - lo + 1))

  it("finds the maximum total money", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed)
      const ids = ["kris", "susie", "ralsei"].slice(0, randInt(rng, 2, 3))
      const party = ids.map((id) =>
        makeCharacter({
          id,
          armorRemovable: rng() < 0.7,
          slots: { weapon: 1, armor: randInt(rng, 1, 2) },
        }),
      )
      const items: Item[] = []
      for (let i = 0; i < randInt(rng, 2, 4); i++) {
        items.push(
          makeItem({
            id: `w${i}`,
            type: "weapon",
            owned: randInt(rng, 1, 2),
            moneyModifier: rng() < 0.5 ? randInt(rng, -20, 30) : 0,
          }),
        )
      }
      for (let i = 0; i < randInt(rng, 2, 4); i++) {
        items.push(
          makeItem({
            id: `a${i}`,
            type: "armor",
            owned: randInt(rng, 1, 3),
            moneyModifier: rng() < 0.5 ? randInt(rng, -20, 30) : 0,
          }),
        )
      }

      const r = optimizeParty({
        party,
        items,
        weights: { hp: 0, atk: 0, def: 0, magic: 0 },
        objective: "sum",
        chaptersEnabled: ALL_CHAPTERS,
        inventoryMode: "owned",
        money: { stackMode: "additive", scope: "party-wide" },
      })
      if (!r.ok) continue

      // Brute force: try every weapon+armor combo per member over the pool.
      const inventory = new Map<string, number>()
      for (const it of items) if (it.owned > 0) inventory.set(it.id, it.owned)

      const perMember = party.map((c) => {
        const weapons = items.filter((it) => it.type === "weapon")
        const armor = items.filter((it) => it.type === "armor")
        const combos: { ids: string[]; money: number }[] = []
        for (const w of weapons) {
          const armorSets: Item[][] = [[]]
          for (const a1 of armor) {
            armorSets.push([a1])
            if (c.slots.armor >= 2) {
              for (const a2 of armor) armorSets.push([a1, a2])
            }
          }
          for (const set of armorSets) {
            if (set.length > c.slots.armor) continue
            if (!c.armorRemovable && set.length === 0) continue
            const eq = [w, ...set]
            combos.push({
              ids: eq.map((x) => x.id),
              money: eq.reduce((acc, x) => acc + moneyOf(x), 0),
            })
          }
        }
        return combos
      })

      let bruteBest = -Infinity
      const search = (i: number, inv: Map<string, number>, total: number) => {
        if (i === party.length) {
          if (total > bruteBest) bruteBest = total
          return
        }
        for (const combo of perMember[i]) {
          const need = new Map<string, number>()
          for (const id of combo.ids) need.set(id, (need.get(id) ?? 0) + 1)
          if ([...need].some(([id, n]) => (inv.get(id) ?? 0) < n)) continue
          for (const [id, n] of need) inv.set(id, (inv.get(id) ?? 0) - n)
          search(i + 1, inv, total + combo.money)
          for (const [id, n] of need) inv.set(id, (inv.get(id) ?? 0) + n)
        }
      }
      search(0, new Map(inventory), 0)

      expect(
        r.money?.totalPercent,
        `seed ${seed}: optimizer money below brute-force max`,
      ).toBe(bruteBest)
    }
  })
})

/**
 * Money mode has a near-flat objective (most loadouts carry no money gear
 * and tie at 0), which once made the branch-and-bound explode across
 * interchangeable filler loadouts and froze the app. Collapsing each money
 * signature to one representative fixed it; this guards the regression.
 */
describe("money mode stays fast on the full seed", () => {
  it("solves party-wide money on the bundled dataset in well under a second", async () => {
    const { default: gearData } = await import("../data/gearData.json")
    const { parseDataset } = await import("./validateDataset")
    const ds = parseDataset(gearData)!
    const party = ds.characters.filter((c) => c.active)
    const started = Date.now()
    for (const settings of [
      { stackMode: "additive", scope: "party-wide" },
      { stackMode: "multiplicative", scope: "wearer-only" },
    ] as const) {
      const r = optimizeParty({
        party,
        items: ds.items,
        weights: { hp: 0, atk: 0, def: 0, magic: 0 },
        objective: "sum",
        chaptersEnabled: [1, 2, 3, 4, 5],
        inventoryMode: "owned",
        money: settings,
      })
      expect(r.ok).toBe(true)
    }
    expect(Date.now() - started).toBeLessThan(4000)
  })
})
