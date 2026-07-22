import { describe, expect, it } from "vitest"
import gearData from "../data/gearData.json"
import { optimizeParty } from "./partyOptimizer"
import { builtinPresets } from "./presets"
import { parseDataset } from "./validateDataset"

/**
 * Guard against the tiebreak becoming combinatorial.
 *
 * An earlier version settled ties inside the branch-and-bound by keeping
 * every equal-scoring branch alive. On a stat preset — where most
 * loadouts tie because the other three stats are ignored — that turned a
 * sub-second search into minutes and froze the app. The tiebreak now runs
 * as a bounded post-pass, so annotating gear must not measurably change
 * search time.
 */
describe("beneficiary tiebreak stays cheap", () => {
  const dataset = parseDataset(gearData)
  const party = dataset!.characters.filter((c) => c.active)
  const annotated = dataset!.items.map((it) =>
    it.ability
      ? { ...it, ability: { ...it.ability, beneficiaries: ["ralsei"] } }
      : it,
  )

  it("solves every built-in preset with fully annotated gear in reasonable time", () => {
    const started = Date.now()
    for (const preset of builtinPresets()) {
      for (const objective of ["sum", "maximin"] as const) {
        const result = optimizeParty({
          party,
          items: annotated,
          weights: preset.weights,
          objective,
          chaptersEnabled: [1, 2, 3, 4, 5],
          inventoryMode: "owned",
        })
        expect(result.ok).toBe(true)
      }
    }
    // Comfortably under a second in practice; the bound catches a regression
    // to the old behaviour (minutes) without being flaky on a loaded machine.
    expect(Date.now() - started).toBeLessThan(15000)
  })
})
