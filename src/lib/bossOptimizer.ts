import type {
  Boss,
  Character,
  Element,
  InventoryMode,
  Item,
  Stats,
} from "../types/data"
import {
  canEquipNow,
  enumerateArmorSelections,
  isAvailable,
  isCandidateFor,
  totalStats,
} from "./optimizer"
import {
  improveBeneficiaryFit,
  loadoutUsage,
  solvePool,
  type BlockedMember,
  type MemberLoadout,
  type SearchMember,
} from "./partyOptimizer"
import { ELEMENTS, ELEMENT_LABELS } from "./resistanceFormat"

/*
 * Damage model (explicit assumptions, all tunable):
 * - A boss hit has a nominal raw size of NOMINAL_HIT.
 * - DEF reduces the raw hit subtractively (DEF_REDUCTION per point),
 *   floored at MIN_HIT so armor can never zero out damage entirely —
 *   this keeps elemental resistance relevant at high DEF and vice
 *   versa: resistance multiplies what DEF leaves behind, so a resist
 *   item is NOT a DEF substitute. Which one wins depends on how much
 *   of the boss's damage its element actually carries.
 * - threat = damage per hit as a fraction of the member's HP pool
 *   (BASE_HP_POOL + gear HP), so both DEF and HP buy survivability.
 * - The party objective minimizes total threat. When the win
 *   condition is "fight", ATK gets a small tiebreak weight; for
 *   "spare"/"special" it is exactly 0 so ATK gear is never favored.
 */
const NOMINAL_HIT = 100
const DEF_REDUCTION = 3
const MIN_HIT = 10
const BASE_HP_POOL = 90
const ATK_TIEBREAK = 0.01

export interface WhyLine {
  itemName: string
  text: string
}

export interface BossMemberResult {
  character: Character
  weapon: Item
  armor: Item[]
  totals: Stats
  /** Elemental multiplier incl. special rules, 1 = unresisted. */
  damageMultiplier: number
  /** Modeled damage per nominal hit, after DEF and resistances. */
  perHit: number
  /** perHit as a fraction of this member's HP pool (lower is better). */
  threat: number
  why: WhyLine[]
}

export interface ItemVerdict {
  item: Item
  used: boolean
  usedBy?: string
  reasons: string[]
}

export interface BossOptimizeInput {
  boss: Boss
  party: Character[]
  items: Item[]
  chaptersEnabled: number[]
  inventoryMode: InventoryMode
}

export type BossOptimizeResult =
  | {
      ok: true
      assignments: BossMemberResult[]
      blocked: BlockedMember[]
      partyThreat: number
      verdicts: ItemVerdict[]
      leftovers: { item: Item; unused: number }[]
    }
  | { ok: false; reason: string }

function resolvedPercent(
  item: Item,
  element: Exclude<Element, "all">,
  bossChapter: number,
): number {
  let total = 0
  for (const r of item.resistances ?? []) {
    if (r.element !== element && r.element !== "all") continue
    total += r.chapterOverrides?.[bossChapter] ?? r.percent
  }
  return total
}

/** Summed armor resistance per element, additive across pieces, capped at 100. */
export function totalResistances(
  armor: Item[],
  bossChapter: number,
): Record<Exclude<Element, "all">, number> {
  const out = {} as Record<Exclude<Element, "all">, number>
  for (const element of ELEMENTS) {
    const sum = armor.reduce(
      (acc, piece) => acc + resolvedPercent(piece, element, bossChapter),
      0,
    )
    out[element] = Math.min(sum, 100)
  }
  return out
}

/** Elemental damage multiplier vs the boss's profile; neutral is always full weight. */
export function damageMultiplierFor(
  armor: Item[],
  boss: Boss,
): number {
  const resist = totalResistances(armor, boss.chapter)
  let multiplier = boss.damageProfile.neutral ?? 0
  for (const element of ELEMENTS) {
    const share = boss.damageProfile[element] ?? 0
    if (share === 0) continue
    multiplier += share * (1 - resist[element] / 100)
  }
  return multiplier
}

function specialRuleFactor(
  boss: Boss,
  character: Character,
  equipped: Item[],
): { factor: number; applied: { itemName: string; reduction: number }[] } {
  let factor = 1
  const applied: { itemName: string; reduction: number }[] = []
  for (const rule of boss.specialRules ?? []) {
    if (rule.requiredCharacterId && rule.requiredCharacterId !== character.id)
      continue
    const worn = equipped.some(
      (it) => it.name.toLowerCase() === rule.itemName.toLowerCase(),
    )
    if (!worn) continue
    factor *= 1 - rule.flatReduction
    applied.push({ itemName: rule.itemName, reduction: rule.flatReduction })
  }
  return { factor, applied }
}

interface EvaluatedLoadout extends MemberLoadout {
  damageMultiplier: number
  perHit: number
  threat: number
}

function evaluateLoadout(
  character: Character,
  weapon: Item,
  armor: Item[],
  boss: Boss,
): EvaluatedLoadout {
  const totals = totalStats(character, [weapon, ...armor])
  const elemental = damageMultiplierFor(armor, boss)
  const special = specialRuleFactor(boss, character, [weapon, ...armor])
  const damageMultiplier = elemental * special.factor
  const perHit =
    Math.max(NOMINAL_HIT - DEF_REDUCTION * totals.def, MIN_HIT) *
    damageMultiplier
  const pool = Math.max(1, BASE_HP_POOL + totals.hp)
  const threat = perHit / pool
  // Character stat relevance applies to the ATK tiebreak only. HP and DEF
  // are not preferences here — they are inputs to a damage model, and
  // scaling them would report damage numbers the model doesn't predict.
  const atkBonus =
    boss.winCondition === "fight"
      ? ATK_TIEBREAK * totals.atk * character.statWeights.atk
      : 0
  return {
    weapon,
    armor,
    totals,
    score: -threat + atkBonus,
    damageMultiplier,
    perHit,
    threat,
  }
}

function enumerateBossLoadouts(
  character: Character,
  items: Item[],
  boss: Boss,
  chaptersEnabled: number[],
  inventoryMode: InventoryMode,
): EvaluatedLoadout[] {
  const eligible = items.filter((it) =>
    isCandidateFor(it, character, chaptersEnabled, inventoryMode),
  )
  const weapons = eligible.filter((it) => it.type === "weapon")
  const armorCandidates = eligible.filter((it) => it.type === "armor")

  let armorSelections = enumerateArmorSelections(
    armorCandidates,
    character.slots.armor,
    inventoryMode,
  )
  if (!character.armorRemovable) {
    armorSelections = armorSelections.filter((sel) => sel.length > 0)
  }

  const loadouts: EvaluatedLoadout[] = []
  for (const weapon of weapons) {
    for (const armor of armorSelections) {
      loadouts.push(evaluateLoadout(character, weapon, armor, boss))
    }
  }
  loadouts.sort((a, b) => b.score - a.score)
  return loadouts
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function whyLinesFor(
  loadout: EvaluatedLoadout,
  character: Character,
  boss: Boss,
): WhyLine[] {
  const lines: WhyLine[] = []
  const special = specialRuleFactor(boss, character, [
    loadout.weapon,
    ...loadout.armor,
  ])

  for (const piece of loadout.armor) {
    const facts: string[] = []
    for (const element of ELEMENTS) {
      const p = resolvedPercent(piece, element, boss.chapter)
      const share = boss.damageProfile[element] ?? 0
      if (p !== 0 && share > 0) {
        facts.push(
          `${p}% ${ELEMENT_LABELS[element]} resist, and ${boss.name} deals ~${pct(share)} ${ELEMENT_LABELS[element]}`,
        )
      }
    }
    const rule = special.applied.find(
      (r) => r.itemName.toLowerCase() === piece.name.toLowerCase(),
    )
    if (rule) {
      facts.push(
        `cuts ${boss.name}'s special attacks by a flat ${pct(rule.reduction)}`,
      )
    }
    if (facts.length === 0) {
      const statBits: string[] = []
      if (piece.stats.def !== 0) statBits.push(`${piece.stats.def} DEF`)
      if (piece.stats.hp !== 0) statBits.push(`${piece.stats.hp} HP`)
      const neutralShare = boss.damageProfile.neutral ?? 0
      facts.push(
        statBits.length > 0
          ? `raw bulk (${statBits.join(", ")}) against the ~${pct(neutralShare)} unresisted share`
          : `best remaining option for this slot`,
      )
    }
    lines.push({ itemName: piece.name, text: facts.join("; ") })
  }
  return lines
}

export function optimizeVsBoss(input: BossOptimizeInput): BossOptimizeResult {
  const { boss, party, items, chaptersEnabled, inventoryMode } = input

  if (party.length === 0) {
    return { ok: false, reason: "No active party members selected." }
  }

  const blocked: BlockedMember[] = []
  const equippableParty: typeof party = []
  for (const character of party) {
    const eligible = items.filter((it) =>
      isCandidateFor(it, character, chaptersEnabled, inventoryMode),
    )
    if (!eligible.some((it) => it.type === "weapon")) {
      blocked.push({
        character,
        reason: `No available weapon for ${character.name} — check owned counts, chapter filter, and exclusions.`,
      })
      continue
    }
    if (
      !character.armorRemovable &&
      !eligible.some((it) => it.type === "armor")
    ) {
      blocked.push({
        character,
        reason: `${character.name} cannot unequip armor, but no armor is available — check owned counts, chapter filter, and exclusions.`,
      })
      continue
    }
    equippableParty.push(character)
  }

  if (equippableParty.length === 0) {
    return {
      ok: true,
      assignments: [],
      blocked,
      partyThreat: 0,
      verdicts: [],
      leftovers: items
        .filter((it) => it.owned > 0)
        .map((it) => ({ item: it, unused: it.owned })),
    }
  }

  const memberLoadouts = equippableParty.map((character) => ({
    character,
    loadouts: enumerateBossLoadouts(
      character,
      items,
      boss,
      chaptersEnabled,
      inventoryMode,
    ),
  }))

  let picksByCharacter: Map<string, EvaluatedLoadout>

  if (inventoryMode === "unlimited") {
    picksByCharacter = new Map(
      memberLoadouts.map(({ character, loadouts }) => [
        character.id,
        loadouts[0],
      ]),
    )
  } else {
    // Abilities are unscored here too — beneficiaries only break ties.
    const tiebreakInPlay = memberLoadouts.some(({ loadouts }) =>
      loadouts.some((l) =>
        [l.weapon, ...l.armor].some(
          (it) => (it.ability?.beneficiaries ?? []).length > 0,
        ),
      ),
    )
    const ordered: SearchMember[] = memberLoadouts
      .map(({ character, loadouts }) => ({
        character,
        loadouts,
        usages: loadouts.map(loadoutUsage),
      }))
      .sort((a, b) => a.loadouts.length - b.loadouts.length)

    const inventory = new Map<string, number>()
    for (const it of items) {
      if (it.owned > 0) inventory.set(it.id, it.owned)
    }

    const solution = solvePool(ordered, "sum", inventory)
    if (!solution) {
      return {
        ok: false,
        reason:
          "The owned pool cannot equip every party member at once. Add owned counts or switch to unlimited mode.",
      }
    }
    // Equal-threat swaps only — abilities never change the damage math.
    const picks = tiebreakInPlay
      ? improveBeneficiaryFit(ordered, solution.picks, inventory)
      : solution.picks

    picksByCharacter = new Map(
      ordered.map((m, i) => [
        m.character.id,
        m.loadouts[picks[i]] as EvaluatedLoadout,
      ]),
    )
  }

  const assignments: BossMemberResult[] = equippableParty.map((character) => {
    const pick = picksByCharacter.get(character.id) as EvaluatedLoadout
    return {
      character,
      weapon: pick.weapon,
      armor: pick.armor,
      totals: pick.totals,
      damageMultiplier: pick.damageMultiplier,
      perHit: pick.perHit,
      threat: pick.threat,
      why: whyLinesFor(pick, character, boss),
    }
  })

  const partyThreat = assignments.reduce((acc, a) => acc + a.threat, 0)

  // Leftover owned inventory, as in M3.
  const used = new Map<string, number>()
  for (const a of assignments) {
    used.set(a.weapon.id, (used.get(a.weapon.id) ?? 0) + 1)
    for (const piece of a.armor) {
      used.set(piece.id, (used.get(piece.id) ?? 0) + 1)
    }
  }
  const leftovers = items
    .filter((it) => it.owned > 0)
    .map((it) => ({ item: it, unused: it.owned - (used.get(it.id) ?? 0) }))
    .filter(({ unused }) => unused > 0)

  // Considered-and-rejected verdicts — the part that explains the tradeoff.
  const verdicts: ItemVerdict[] = []
  const candidateItems = items.filter(
    (it) =>
      it.type === "armor" &&
      isAvailable(it, chaptersEnabled, inventoryMode) &&
      party.some((c) => canEquipNow(it, c, chaptersEnabled)),
  )
  for (const item of candidateItems) {
    const wearer = assignments.find((a) =>
      a.armor.some((piece) => piece.id === item.id),
    )
    const beneficiaries = item.ability?.beneficiaries ?? []
    const beneficiaryNames = beneficiaries.map(
      (id) => party.find((c) => c.id === id)?.name ?? id,
    )

    if (wearer) {
      const reasons = [
        ...new Set(
          wearer.why.filter((w) => w.itemName === item.name).map((w) => w.text),
        ),
      ]
      if (beneficiaries.length > 0) {
        reasons.push(
          beneficiaries.includes(wearer.character.id)
            ? `its ability benefits ${wearer.character.name}, which broke the tie in their favour`
            : `its ability doesn't benefit ${wearer.character.name} — no equal-scoring alternative was free`,
        )
      }
      verdicts.push({
        item,
        used: true,
        usedBy: wearer.character.name,
        reasons,
      })
      continue
    }

    const reasons: string[] = []

    // Held back and appended after the stat reasons, so it supplements
    // them rather than suppressing the "no relevant resistance" line.
    const beneficiaryReason =
      beneficiaries.length === 0
        ? null
        : beneficiaries.some((id) => party.some((c) => c.id === id))
          ? `its ability benefits ${beneficiaryNames.join(", ")}, but abilities are never scored — it lost on stats, not on the tiebreak`
          : `its ability only benefits ${beneficiaryNames.join(", ")}, who isn't in this party`

    // Does it resist anything this boss actually uses?
    const matching = ELEMENTS.filter(
      (el) =>
        resolvedPercent(item, el, boss.chapter) > 0 &&
        (boss.damageProfile[el] ?? 0) > 0,
    )
    const nonMatching = ELEMENTS.filter(
      (el) =>
        resolvedPercent(item, el, boss.chapter) > 0 &&
        (boss.damageProfile[el] ?? 0) === 0,
    )

    // Unmet character requirement on a special rule?
    const characterGatedRule = (boss.specialRules ?? []).find(
      (r) =>
        r.itemName.toLowerCase() === item.name.toLowerCase() &&
        r.requiredCharacterId !== undefined &&
        !party.some((c) => c.id === r.requiredCharacterId),
    )
    if (characterGatedRule) {
      reasons.push(
        `its special rule for ${boss.name} only works on a character who isn't in the party`,
      )
    }

    // Best-case swap onto the member it suits best, holding others fixed.
    let bestDelta: { member: string; pctWorse: number } | null = null
    for (const { character, loadouts } of memberLoadouts) {
      if (!canEquipNow(item, character, chaptersEnabled)) continue
      const assigned = picksByCharacter.get(character.id)
      if (!assigned) continue
      const withItem = loadouts.find((l) =>
        l.armor.some((piece) => piece.id === item.id),
      ) as EvaluatedLoadout | undefined
      if (!withItem) continue
      const pctWorse =
        assigned.threat > 0
          ? ((withItem.threat - assigned.threat) / assigned.threat) * 100
          : 0
      if (bestDelta === null || pctWorse < bestDelta.pctWorse) {
        bestDelta = { member: character.name, pctWorse }
      }
    }

    if (matching.length > 0) {
      const el = matching[0]
      const deltaText =
        bestDelta && bestDelta.pctWorse > 0
          ? ` but swapping it in raises ${bestDelta.member}'s damage taken ~${Math.round(bestDelta.pctWorse)}% — its stats lose more to ${boss.name}'s other damage than the resist saves`
          : ` but the picked gear still comes out ahead`
      reasons.push(
        `resists the right element (${resolvedPercent(item, el, boss.chapter)}% ${ELEMENT_LABELS[el]}),${deltaText}`,
      )
    } else if (nonMatching.length > 0) {
      reasons.push(
        `resists ${nonMatching.map((el) => ELEMENT_LABELS[el]).join(", ")}, which ${boss.name} doesn't use`,
      )
    } else if (reasons.length === 0) {
      const deltaText =
        bestDelta && bestDelta.pctWorse > 0
          ? ` — the picks take ~${Math.round(bestDelta.pctWorse)}% less damage`
          : ""
      reasons.push(`no relevant resistance${deltaText}`)
    }

    if (beneficiaryReason) reasons.push(beneficiaryReason)

    verdicts.push({ item, used: false, reasons })
  }

  return { ok: true, assignments, blocked, partyThreat, verdicts, leftovers }
}
