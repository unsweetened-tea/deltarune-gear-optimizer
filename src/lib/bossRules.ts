import type { BossSpecialRule } from "../types/data"

/**
 * Hardcoded per-boss special-rule seeds for attacks that bypass the
 * element system. Matched by boss name (case-insensitive substring)
 * when a boss is created in the editor; the user can edit or delete
 * the seeded rules afterwards. Rules reference items by NAME so they
 * stay valid across re-imports; a rule is inert until an item with
 * that name exists in the dataset.
 */
const SEEDS: { namePattern: RegExp; rules: BossSpecialRule[] }[] = [
  {
    // Titan / Titan Spawn — Shadow Mantle halves it, any wearer.
    namePattern: /titan/i,
    rules: [{ itemName: "Shadow Mantle", flatReduction: 0.5 }],
  },
  {
    // Hammer of Justice — Shadow Mantle 85%, but only on Susie.
    namePattern: /hammer\s*of\s*justice/i,
    rules: [
      {
        itemName: "Shadow Mantle",
        requiredCharacterId: "susie",
        flatReduction: 0.85,
      },
    ],
  },
]

export function seedSpecialRulesFor(bossName: string): BossSpecialRule[] {
  const seed = SEEDS.find((s) => s.namePattern.test(bossName))
  return seed ? seed.rules.map((r) => ({ ...r })) : []
}
