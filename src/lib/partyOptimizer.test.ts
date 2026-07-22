import { describe, expect, it } from "vitest"
import type { Character, Item, Stats } from "../types/data"
import { optimize } from "./optimizer"
import {
  enumerateMemberLoadouts,
  optimizeParty,
  type MemberLoadout,
  type PartyObjective,
} from "./partyOptimizer"

function makeCharacter(overrides: Partial<Character> & { id: string }): Character {
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

function makeItem(overrides: Partial<Item> & { id: string; type: Item["type"] }): Item {
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

const UNIT_WEIGHTS: Stats = { hp: 1, atk: 1, def: 1, magic: 1 }

/**
 * Reference implementation: plain cartesian-product brute force over
 * the same per-member loadout lists, with no ordering, no bounds, and
 * no pruning. Slow but obviously correct.
 */
function bruteForceBest(
  perMember: MemberLoadout[][],
  objective: PartyObjective,
  inventory: Map<string, number>,
): number | null {
  let best: number | null = null

  function usageOf(loadout: MemberLoadout): Map<string, number> {
    const usage = new Map<string, number>()
    usage.set(loadout.weapon.id, 1)
    for (const a of loadout.armor) usage.set(a.id, (usage.get(a.id) ?? 0) + 1)
    return usage
  }

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
      const usage = usageOf(loadout)
      let ok = true
      for (const [id, count] of usage) {
        if ((inv.get(id) ?? 0) < count) {
          ok = false
          break
        }
      }
      if (!ok) continue
      for (const [id, count] of usage) inv.set(id, (inv.get(id) ?? 0) - count)
      scores.push(loadout.score)
      recurse(i + 1, inv, scores)
      scores.pop()
      for (const [id, count] of usage) inv.set(id, (inv.get(id) ?? 0) + count)
    }
  }

  recurse(0, inventory, [])
  return best
}

// Deterministic PRNG so failures are reproducible.
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

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

function randomScenario(rng: () => number) {
  const charIds = ["kris", "susie", "ralsei"].slice(0, randomInt(rng, 2, 3))
  const party = charIds.map((id) =>
    makeCharacter({
      id,
      armorRemovable: rng() < 0.7,
      baseStats: {
        hp: randomInt(rng, 0, 3),
        atk: randomInt(rng, 0, 3),
        def: randomInt(rng, 0, 3),
        magic: randomInt(rng, 0, 3),
      },
    }),
  )

  const items: Item[] = []
  const nWeapons = randomInt(rng, 2, 4)
  const nArmor = randomInt(rng, 2, 4)
  for (let i = 0; i < nWeapons + nArmor; i++) {
    const restricted = rng() < 0.3
    items.push(
      makeItem({
        id: `item-${i}`,
        type: i < nWeapons ? "weapon" : "armor",
        stats: {
          hp: randomInt(rng, -3, 5),
          atk: randomInt(rng, -3, 5),
          def: randomInt(rng, -3, 5),
          magic: randomInt(rng, -3, 5),
        },
        owned: randomInt(rng, 0, 2),
        equippableBy: restricted
          ? charIds.filter(() => rng() < 0.6)
          : "all",
        excludedFrom: charIds.filter(() => rng() < 0.15),
      }),
    )
  }

  const weights: Stats = {
    hp: randomInt(rng, 0, 2),
    atk: randomInt(rng, 0, 2),
    def: randomInt(rng, 0, 2),
    magic: randomInt(rng, 0, 2),
  }

  return { party, items, weights }
}

describe("optimizeParty branch-and-bound vs brute force", () => {
  it("matches the brute-force optimum on random shared-pool scenarios", () => {
    const rng = mulberry32(20260709)
    for (let trial = 0; trial < 200; trial++) {
      const { party, items, weights } = randomScenario(rng)
      const objective: PartyObjective = trial % 2 === 0 ? "sum" : "maximin"

      const result = optimizeParty({
        party,
        items,
        weights,
        objective,
        chaptersEnabled: [1, 2, 3, 4, 5],
        inventoryMode: "owned",
      })

      const perMember = party.map((c) =>
        enumerateMemberLoadouts(c, items, weights, [1, 2, 3, 4, 5], "owned"),
      )
      // M6: members with zero individually-legal loadouts are reported
      // as blocked, not failed — brute-force only the equippable rest.
      const equippablePerMember = perMember.filter((l) => l.length > 0)
      const expectedBlocked = perMember.length - equippablePerMember.length

      if (equippablePerMember.length === 0) {
        expect(result.ok, `trial ${trial}: all-blocked is ok:true`).toBe(true)
        if (result.ok) {
          expect(result.assignments).toHaveLength(0)
          expect(result.blocked).toHaveLength(expectedBlocked)
        }
        continue
      }

      const inventory = new Map<string, number>()
      for (const it of items) if (it.owned > 0) inventory.set(it.id, it.owned)
      const expected = bruteForceBest(
        equippablePerMember,
        objective,
        inventory,
      )

      if (expected === null) {
        expect(result.ok, `trial ${trial}: expected infeasible`).toBe(false)
        continue
      }
      expect(result.ok, `trial ${trial}: expected feasible`).toBe(true)
      if (result.ok) {
        expect(
          result.blocked,
          `trial ${trial}: blocked count`,
        ).toHaveLength(expectedBlocked)
        expect(
          result.objectiveScore,
          `trial ${trial} (${objective}): B&B diverged from brute force`,
        ).toBe(expected)

        // Independently re-verify the returned assignment is pool-valid.
        const used = new Map<string, number>()
        for (const a of result.assignments) {
          used.set(a.weapon.id, (used.get(a.weapon.id) ?? 0) + 1)
          for (const arm of a.armor) used.set(arm.id, (used.get(arm.id) ?? 0) + 1)
        }
        for (const [id, count] of used) {
          const item = items.find((it) => it.id === id)
          expect(item && count <= item.owned, `trial ${trial}: overused ${id}`).toBe(true)
        }
      }
    }
  })
})

describe("shared-pool constraint", () => {
  const kris = makeCharacter({ id: "kris" })
  const ralsei = makeCharacter({ id: "ralsei" })
  const swordA = makeItem({ id: "sword-a", type: "weapon", stats: { hp: 0, atk: 1, def: 0, magic: 0 }, owned: 1 })
  const swordB = makeItem({ id: "sword-b", type: "weapon", stats: { hp: 0, atk: 1, def: 0, magic: 0 }, owned: 1 })
  const dealmaker = makeItem({ id: "dealmaker", type: "armor", stats: { hp: 0, atk: 10, def: 0, magic: 0 }, owned: 1 })

  it("equips a single owned copy on exactly one member", () => {
    const result = optimizeParty({
      party: [kris, ralsei],
      items: [swordA, swordB, dealmaker],
      weights: UNIT_WEIGHTS,
      objective: "sum",
      chaptersEnabled: [1],
      inventoryMode: "owned",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      const wearers = result.assignments.filter((a) =>
        a.armor.some((x) => x.id === "dealmaker"),
      )
      expect(wearers).toHaveLength(1)
    }
  })

  it("duplicates it freely in unlimited mode", () => {
    const result = optimizeParty({
      party: [kris, ralsei],
      items: [swordA, swordB, dealmaker],
      weights: UNIT_WEIGHTS,
      objective: "sum",
      chaptersEnabled: [1],
      inventoryMode: "unlimited",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Each member independently wears two Dealmakers.
      for (const a of result.assignments) {
        expect(a.armor.filter((x) => x.id === "dealmaker")).toHaveLength(2)
      }
    }
  })

  it("reports infeasibility instead of dropping a member", () => {
    const result = optimizeParty({
      party: [kris, ralsei],
      items: [swordA, dealmaker], // one weapon, two members
      weights: UNIT_WEIGHTS,
      objective: "sum",
      chaptersEnabled: [1],
      inventoryMode: "owned",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/cannot equip every party member/)
  })
})

describe("objectives diverge", () => {
  // One tanky member-agnostic armor pair: sum stacks both on one member,
  // maximin spreads them so the weakest member is lifted.
  const kris = makeCharacter({ id: "kris" })
  const ralsei = makeCharacter({ id: "ralsei" })
  const swordA = makeItem({ id: "sword-a", type: "weapon", owned: 1 })
  const swordB = makeItem({ id: "sword-b", type: "weapon", owned: 1 })
  const plateA = makeItem({ id: "plate-a", type: "armor", stats: { hp: 0, atk: 0, def: 5, magic: 0 }, owned: 1 })
  const plateB = makeItem({ id: "plate-b", type: "armor", stats: { hp: 0, atk: 0, def: 4, magic: 0 }, owned: 1 })

  const base = {
    party: [kris, ralsei],
    items: [swordA, swordB, plateA, plateB],
    weights: UNIT_WEIGHTS,
    chaptersEnabled: [1],
    inventoryMode: "owned" as const,
  }

  it("maximin spreads armor to lift the weakest member", () => {
    const result = optimizeParty({ ...base, objective: "maximin" })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.assignments.every((a) => a.armor.length === 1)).toBe(true)
      expect(result.objectiveScore).toBe(4) // weakest member wears plate-b
    }
  })

  it("weighted sum reaches the same total however armor is split", () => {
    const result = optimizeParty({ ...base, objective: "sum" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.objectiveScore).toBe(9)
  })
})

describe("armorRemovable constraint in party mode", () => {
  it("always gives Susie-type members at least one armor", () => {
    const susie = makeCharacter({ id: "susie", armorRemovable: false })
    const kris = makeCharacter({ id: "kris" })
    const swordA = makeItem({ id: "sword-a", type: "weapon", owned: 1 })
    const swordB = makeItem({ id: "sword-b", type: "weapon", owned: 1 })
    // Negative armor: a naive optimizer would leave it off everyone.
    const cursedPlate = makeItem({ id: "cursed-plate", type: "armor", stats: { hp: 0, atk: 0, def: -5, magic: 0 }, owned: 1 })

    const result = optimizeParty({
      party: [susie, kris],
      items: [swordA, swordB, cursedPlate],
      weights: UNIT_WEIGHTS,
      objective: "sum",
      chaptersEnabled: [1],
      inventoryMode: "owned",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      const susieAssignment = result.assignments.find(
        (a) => a.character.id === "susie",
      )
      expect(susieAssignment?.armor.length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe("M6: shared candidate pool", () => {
  const kris = makeCharacter({ id: "kris" })
  const ralsei = makeCharacter({ id: "ralsei" })
  const sword = makeItem({ id: "sword", type: "weapon", stats: { hp: 0, atk: 1, def: 0, magic: 0 } })
  const godWeapon = makeItem({
    id: "everybody-weapon",
    type: "weapon",
    stats: { hp: 99, atk: 99, def: 99, magic: 99 },
    excludeFromOptimizer: true,
  })

  it("never considers excludeFromOptimizer items, even in unlimited mode", () => {
    for (const inventoryMode of ["owned", "unlimited"] as const) {
      const party = optimizeParty({
        party: [kris],
        items: [sword, godWeapon],
        weights: UNIT_WEIGHTS,
        objective: "sum",
        chaptersEnabled: [1],
        inventoryMode,
      })
      expect(party.ok).toBe(true)
      if (party.ok) {
        expect(party.assignments[0].weapon.id).toBe("sword")
      }

      const solo = optimize({
        character: kris,
        items: [sword, godWeapon],
        targetStat: "atk",
        chaptersEnabled: [1],
        inventoryMode,
      })
      expect(solo.ok).toBe(true)
      if (solo.ok) {
        expect(solo.loadouts[0].weapon.id).toBe("sword")
      }
    }
  })

  it("blocks a member with no legal weapon instead of failing the party", () => {
    const krisOnlySword = makeItem({
      id: "kris-sword",
      type: "weapon",
      equippableBy: ["kris"],
    })
    const result = optimizeParty({
      party: [kris, ralsei],
      items: [krisOnlySword],
      weights: UNIT_WEIGHTS,
      objective: "sum",
      chaptersEnabled: [1],
      inventoryMode: "owned",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.assignments).toHaveLength(1)
      expect(result.assignments[0].character.id).toBe("kris")
      expect(result.blocked).toHaveLength(1)
      expect(result.blocked[0].character.id).toBe("ralsei")
      expect(result.blocked[0].reason).toMatch(/No available weapon/)
    }
  })

  it("pruning owned to 0 removes the item and re-solve finds the alternative", () => {
    const best = makeItem({ id: "best", type: "weapon", stats: { hp: 0, atk: 9, def: 0, magic: 0 } })
    const backup = makeItem({ id: "backup", type: "weapon", stats: { hp: 0, atk: 2, def: 0, magic: 0 } })
    const before = optimizeParty({
      party: [kris],
      items: [best, backup],
      weights: UNIT_WEIGHTS,
      objective: "sum",
      chaptersEnabled: [1],
      inventoryMode: "owned",
    })
    expect(before.ok && before.assignments[0].weapon.id).toBe("best")

    const pruned = [{ ...best, owned: 0 }, backup]
    const after = optimizeParty({
      party: [kris],
      items: pruned,
      weights: UNIT_WEIGHTS,
      objective: "sum",
      chaptersEnabled: [1],
      inventoryMode: "owned",
    })
    expect(after.ok && after.assignments[0].weapon.id).toBe("backup")

    const afterBoth = optimizeParty({
      party: [kris],
      items: [{ ...best, owned: 0 }, { ...backup, owned: 0 }],
      weights: UNIT_WEIGHTS,
      objective: "sum",
      chaptersEnabled: [1],
      inventoryMode: "owned",
    })
    expect(afterBoth.ok).toBe(true)
    if (afterBoth.ok) {
      expect(afterBoth.assignments).toHaveLength(0)
      expect(afterBoth.blocked[0].reason).toMatch(/No available weapon/)
    }
  })
})
