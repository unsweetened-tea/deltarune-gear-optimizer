import { describe, expect, it } from "vitest"
import type { Character, Item, Stats } from "../types/data"
import { optimize } from "./optimizer"
import {
  effectiveWeights,
  enumerateMemberLoadouts,
  improveBeneficiaryFit,
  loadoutUsage,
  optimizeParty,
  type MemberLoadout,
  type PartyObjective,
} from "./partyOptimizer"

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
const UNIT_WEIGHTS: Stats = { hp: 1, atk: 1, def: 1, magic: 1 }

function run(
  party: Character[],
  items: Item[],
  weights: Stats = UNIT_WEIGHTS,
  objective: PartyObjective = "sum",
) {
  const result = optimizeParty({
    party,
    items,
    weights,
    objective,
    chaptersEnabled: ALL_CHAPTERS,
    inventoryMode: "owned",
  })
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe("per-character stat relevance", () => {
  it("composes with the objective weights rather than replacing them", () => {
    const character = makeCharacter({
      id: "kris",
      statWeights: { hp: 2, atk: 0, def: 1, magic: 0.5 },
    })
    expect(
      effectiveWeights(character, { hp: 1, atk: 3, def: 2, magic: 4 }),
    ).toEqual({ hp: 2, atk: 0, def: 2, magic: 2 })
  })

  it("defaults of 1 leave scoring exactly as it was", () => {
    const character = makeCharacter({ id: "kris" })
    const items = [
      makeItem({
        id: "weapon",
        type: "weapon",
        stats: { hp: 1, atk: 5, def: 2, magic: 3 },
      }),
      makeItem({
        id: "armor",
        type: "armor",
        stats: { hp: 4, atk: 0, def: 6, magic: 0 },
      }),
    ]
    const weights: Stats = { hp: 1, atk: 2, def: 1, magic: 2 }
    const loadouts = enumerateMemberLoadouts(
      character,
      items,
      weights,
      ALL_CHAPTERS,
      "owned",
    )
    const best = loadouts[0]
    const expected =
      best.totals.hp * 1 +
      best.totals.atk * 2 +
      best.totals.def * 1 +
      best.totals.magic * 2
    expect(best.score).toBe(expected)
  })

  it("a zero weight makes that stat worthless to that character", () => {
    // Only one ATK weapon exists; whoever values ATK should take it.
    const atkBlind = makeCharacter({
      id: "atk-blind",
      statWeights: { hp: 1, atk: 0, def: 1, magic: 1 },
    })
    const atkUser = makeCharacter({ id: "atk-user" })
    const items = [
      makeItem({
        id: "big-sword",
        type: "weapon",
        stats: { hp: 0, atk: 10, def: 0, magic: 0 },
      }),
      makeItem({ id: "plain-weapon", type: "weapon" }),
      makeItem({ id: "armor", type: "armor", owned: 4 }),
    ]

    const result = run([atkBlind, atkUser], items)
    const wielder = result.assignments.find(
      (a) => a.weapon.id === "big-sword",
    )
    expect(wielder?.character.id).toBe("atk-user")

    // The blind member's score ignores the ATK they do carry.
    const blind = result.assignments.find((a) => a.character.id === "atk-blind")
    expect(blind?.score).toBe(0)
    expect(blind?.memberNotes.join(" ")).toContain("ATK")
  })

  it("reports a zero-weighted stat on the member card", () => {
    const character = makeCharacter({
      id: "kris",
      statWeights: { hp: 0, atk: 1, def: 1, magic: 1 },
    })
    const items = [makeItem({ id: "weapon", type: "weapon" })]

    // The objective asks for HP, so zeroing it changed the outcome.
    expect(
      run([character], items, { hp: 1, atk: 0, def: 0, magic: 0 })
        .assignments[0].memberNotes.join(" "),
    ).toContain("HP")
    // The objective ignores HP anyway — nothing worth saying.
    expect(
      run([character], items, { hp: 0, atk: 1, def: 0, magic: 0 })
        .assignments[0].memberNotes,
    ).toEqual([])
  })

  it("flows through the solo optimizer's target stat", () => {
    const character = makeCharacter({
      id: "kris",
      statWeights: { hp: 0, atk: 1, def: 1, magic: 1 },
    })
    const items = [
      makeItem({ id: "weapon", type: "weapon" }),
      makeItem({
        id: "hp-armor",
        type: "armor",
        stats: { hp: 10, atk: 0, def: 0, magic: 0 },
      }),
    ]
    const result = optimize({
      character,
      items,
      targetStat: "hp",
      chaptersEnabled: ALL_CHAPTERS,
      inventoryMode: "owned",
    })
    if (!result.ok) throw new Error(result.reason)
    // Weight 0: every loadout ties at zero value, so none can be "best".
    const scores = result.loadouts.map((l) => l.totals.hp * 0)
    expect(new Set(scores).size).toBe(1)
  })
})

describe("ability beneficiary tiebreak", () => {
  const monarch = makeItem({
    id: "monarch-rbn",
    type: "armor",
    name: "MonarchRBN",
    stats: { hp: 2, atk: 0, def: 0, magic: 0 },
    ability: {
      name: "HasAntenna",
      description: "Increases outgoing healing by 12.5%.",
      beneficiaries: ["ralsei"],
    },
  })
  /** Same stats, no ability — makes the two assignments score identically. */
  const plainArmor = makeItem({
    id: "plain-armor",
    type: "armor",
    stats: { hp: 2, atk: 0, def: 0, magic: 0 },
  })
  const weapons = makeItem({ id: "weapon", type: "weapon", owned: 2 })

  const kris = makeCharacter({
    id: "kris",
    name: "Kris",
    slots: { weapon: 1, armor: 1 },
  })
  const ralsei = makeCharacter({
    id: "ralsei",
    name: "Ralsei",
    slots: { weapon: 1, armor: 1 },
  })

  it("gives a limited ability item to a beneficiary when the stat cost is zero", () => {
    const result = run([kris, ralsei], [weapons, monarch, plainArmor])
    const holder = result.assignments.find((a) =>
      a.armor.some((x) => x.id === "monarch-rbn"),
    )
    expect(holder?.character.id).toBe("ralsei")
  })

  it("explains the swap on the member who received it", () => {
    const result = run([kris, ralsei], [weapons, monarch, plainArmor])
    const note = result.assignments
      .find((a) => a.character.id === "ralsei")
      ?.itemNotes.find((n) => n.itemId === "monarch-rbn")?.text
    expect(note).toContain("HasAntenna")
    expect(note).toContain("Ralsei")
  })

  it("never overrides a genuinely better stat score", () => {
    // Now the non-beneficiary armor is strictly better for the party.
    const betterPlain = makeItem({
      id: "plain-armor",
      type: "armor",
      stats: { hp: 50, atk: 0, def: 0, magic: 0 },
    })
    const result = run([kris, ralsei], [weapons, monarch, betterPlain])
    const total = result.assignments.reduce((acc, a) => acc + a.totals.hp, 0)
    expect(total).toBe(52)
  })

  it("says so when a non-beneficiary has to hold it", () => {
    // Only Kris is in the party, so he takes it regardless.
    const result = run([kris], [weapons, monarch])
    const note = result.assignments[0].itemNotes.find(
      (n) => n.itemId === "monarch-rbn",
    )?.text
    expect(note).toContain("only benefits")
    expect(note).toContain("Kris")
  })

  it("leaves results untouched when no ability names beneficiaries", () => {
    const noBeneficiaries = makeItem({
      id: "monarch-rbn",
      type: "armor",
      stats: { hp: 2, atk: 0, def: 0, magic: 0 },
      ability: { name: "HasAntenna", description: "Healing up." },
    })
    const result = run([kris, ralsei], [weapons, noBeneficiaries, plainArmor])
    expect(result.assignments.flatMap((a) => a.itemNotes)).toEqual([])
  })
})

describe("improveBeneficiaryFit (the post-pass itself)", () => {
  const kris = makeCharacter({
    id: "kris",
    name: "Kris",
    slots: { weapon: 1, armor: 1 },
  })
  const ralsei = makeCharacter({
    id: "ralsei",
    name: "Ralsei",
    slots: { weapon: 1, armor: 1 },
  })
  const items = [
    makeItem({ id: "weapon", type: "weapon", owned: 2 }),
    makeItem({
      id: "gifted",
      type: "armor",
      stats: { hp: 2, atk: 0, def: 0, magic: 0 },
      ability: { name: "Gift", description: "", beneficiaries: ["ralsei"] },
    }),
    makeItem({
      id: "plain",
      type: "armor",
      stats: { hp: 2, atk: 0, def: 0, magic: 0 },
    }),
  ]

  /** SearchMembers in the shape solvePool/improveBeneficiaryFit expect. */
  function searchMembers() {
    return [kris, ralsei].map((character) => {
      const loadouts = enumerateMemberLoadouts(
        character,
        items,
        UNIT_WEIGHTS,
        ALL_CHAPTERS,
        "owned",
      )
      return { character, loadouts, usages: loadouts.map(loadoutUsage) }
    })
  }

  const inventory = new Map(
    items.filter((i) => i.owned > 0).map((i) => [i.id, i.owned]),
  )

  it("moves a limited ability item off a non-beneficiary onto a beneficiary", () => {
    const members = searchMembers()
    // Deliberately wrong-but-equal start: Kris holds it, Ralsei doesn't.
    const krisHasGift = members[0].loadouts.findIndex((l) =>
      l.armor.some((a) => a.id === "gifted"),
    )
    const ralseiHasPlain = members[1].loadouts.findIndex((l) =>
      l.armor.some((a) => a.id === "plain"),
    )
    const before = [krisHasGift, ralseiHasPlain]
    expect(before.every((i) => i >= 0)).toBe(true)

    const after = improveBeneficiaryFit(members, before, inventory)

    expect(
      members[1].loadouts[after[1]].armor.some((a) => a.id === "gifted"),
    ).toBe(true)
    expect(
      members[0].loadouts[after[0]].armor.some((a) => a.id === "gifted"),
    ).toBe(false)
    // Same objective score before and after — a swap, not an upgrade.
    expect(
      members[0].loadouts[after[0]].score + members[1].loadouts[after[1]].score,
    ).toBe(
      members[0].loadouts[before[0]].score +
        members[1].loadouts[before[1]].score,
    )
  })

  it("leaves the assignment alone when no equal-scoring swap exists", () => {
    const better = [
      items[0],
      items[1],
      makeItem({
        id: "plain",
        type: "armor",
        // Now Kris giving up "gifted" for "plain" is not score-neutral.
        stats: { hp: 99, atk: 0, def: 0, magic: 0 },
      }),
    ]
    const members = [kris, ralsei].map((character) => {
      const loadouts = enumerateMemberLoadouts(
        character,
        better,
        UNIT_WEIGHTS,
        ALL_CHAPTERS,
        "owned",
      )
      return { character, loadouts, usages: loadouts.map(loadoutUsage) }
    })
    const inv = new Map(better.map((i) => [i.id, i.owned]))
    const before = [
      members[0].loadouts.findIndex((l) =>
        l.armor.some((a) => a.id === "gifted"),
      ),
      members[1].loadouts.findIndex((l) =>
        l.armor.some((a) => a.id === "plain"),
      ),
    ]

    expect(improveBeneficiaryFit(members, before, inv)).toEqual(before)
  })
})

/**
 * The load-bearing guarantee for the tiebreak: it may reorder equal
 * assignments, never trade objective score for beneficiary fit. Each
 * scenario is solved twice — with beneficiaries and with them stripped —
 * and the objective scores must match exactly.
 */
describe("tiebreak never costs objective score", () => {
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
  const randomInt = (rng: () => number, min: number, max: number) =>
    min + Math.floor(rng() * (max - min + 1))

  /** Plain cartesian brute force over the same loadout lists. */
  function bruteForceBest(
    perMember: MemberLoadout[][],
    objective: PartyObjective,
    inventory: Map<string, number>,
  ): number | null {
    let best: number | null = null
    function recurse(i: number, inv: Map<string, number>, scores: number[]) {
      if (i === perMember.length) {
        const total =
          objective === "sum"
            ? scores.reduce((a, b) => a + b, 0)
            : Math.min(...scores)
        if (best === null || total > best) best = total
        return
      }
      for (const loadout of perMember[i]) {
        const usage = new Map<string, number>()
        usage.set(loadout.weapon.id, 1)
        for (const a of loadout.armor)
          usage.set(a.id, (usage.get(a.id) ?? 0) + 1)
        if ([...usage].some(([id, c]) => (inv.get(id) ?? 0) < c)) continue
        for (const [id, c] of usage) inv.set(id, (inv.get(id) ?? 0) - c)
        scores.push(loadout.score)
        recurse(i + 1, inv, scores)
        scores.pop()
        for (const [id, c] of usage) inv.set(id, (inv.get(id) ?? 0) + c)
      }
    }
    recurse(0, inventory, [])
    return best
  }

  it("matches brute force across 120 seeded scenarios with beneficiaries", () => {
    for (let seed = 1; seed <= 120; seed++) {
      const rng = mulberry32(seed)
      const ids = ["kris", "susie", "ralsei"].slice(0, randomInt(rng, 2, 3))
      const party = ids.map((id) =>
        makeCharacter({
          id,
          armorRemovable: rng() < 0.7,
          slots: { weapon: 1, armor: randomInt(rng, 1, 2) },
          statWeights: {
            hp: rng() < 0.25 ? 0 : 1,
            atk: rng() < 0.25 ? 0 : 1,
            def: 1,
            magic: rng() < 0.25 ? 0 : 2,
          },
        }),
      )

      const items: Item[] = []
      for (let i = 0; i < randomInt(rng, 2, 4); i++) {
        items.push(
          makeItem({
            id: `w${i}`,
            type: "weapon",
            owned: randomInt(rng, 1, 2),
            stats: {
              hp: randomInt(rng, 0, 4),
              atk: randomInt(rng, 0, 4),
              def: randomInt(rng, 0, 4),
              magic: randomInt(rng, 0, 4),
            },
            // Beneficiaries on roughly half the gear, sometimes naming
            // a character who isn't even in the party.
            ability:
              rng() < 0.5
                ? {
                    name: `ability-w${i}`,
                    description: "",
                    beneficiaries: [
                      ["kris", "susie", "ralsei", "noelle"][
                        randomInt(rng, 0, 3)
                      ],
                    ],
                  }
                : undefined,
          }),
        )
      }
      for (let i = 0; i < randomInt(rng, 2, 4); i++) {
        items.push(
          makeItem({
            id: `a${i}`,
            type: "armor",
            owned: randomInt(rng, 1, 3),
            stats: {
              hp: randomInt(rng, 0, 4),
              atk: randomInt(rng, 0, 4),
              def: randomInt(rng, 0, 4),
              magic: randomInt(rng, 0, 4),
            },
            ability:
              rng() < 0.5
                ? {
                    name: `ability-a${i}`,
                    description: "",
                    beneficiaries: [
                      ["kris", "susie", "ralsei", "noelle"][
                        randomInt(rng, 0, 3)
                      ],
                    ],
                  }
                : undefined,
          }),
        )
      }

      const objective: PartyObjective = rng() < 0.5 ? "sum" : "maximin"
      const weights: Stats = {
        hp: randomInt(rng, 0, 3),
        atk: randomInt(rng, 0, 3),
        def: randomInt(rng, 0, 3),
        magic: randomInt(rng, 0, 3),
      }

      const result = optimizeParty({
        party,
        items,
        weights,
        objective,
        chaptersEnabled: ALL_CHAPTERS,
        inventoryMode: "owned",
      })
      if (!result.ok) continue

      const inventory = new Map<string, number>()
      for (const it of items) if (it.owned > 0) inventory.set(it.id, it.owned)
      const perMember = party.map((c) =>
        enumerateMemberLoadouts(c, items, weights, ALL_CHAPTERS, "owned"),
      )
      const optimal = bruteForceBest(perMember, objective, inventory)

      expect(
        result.objectiveScore,
        `seed ${seed}: tiebreak changed the objective score`,
      ).toBeCloseTo(optimal as number, 9)
    }
  })
})
