import type { Element, Resistance } from "../types/data"

export const ELEMENTS: Exclude<Element, "all">[] = [
  "puppetCat",
  "darkStar",
  "elecHoly",
  "deathScythe",
]

export const ELEMENT_LABELS: Record<Element | "neutral", string> = {
  puppetCat: "Puppet/Cat",
  darkStar: "Dark/Star",
  elecHoly: "Elec/Holy",
  deathScythe: "Death/Scythe",
  all: "All elements",
  neutral: "Neutral",
}

const ELEMENT_ALIASES: Record<string, Element> = {
  puppetcat: "puppetCat",
  puppet: "puppetCat",
  cat: "puppetCat",
  darkstar: "darkStar",
  dark: "darkStar",
  star: "darkStar",
  elecholy: "elecHoly",
  elec: "elecHoly",
  electric: "elecHoly",
  holy: "elecHoly",
  deathscythe: "deathScythe",
  death: "deathScythe",
  scythe: "deathScythe",
  all: "all",
}

/**
 * Compact text format for editing resistances in a table cell:
 *   "puppet 35 ch5:20; all 10"
 * = [{ element: "puppetCat", percent: 35, chapterOverrides: { 5: 20 } },
 *    { element: "all", percent: 10 }]
 * Entries are ";"-separated; each is `<element> <percent>` followed by
 * optional `ch<N>:<percent>` overrides. Unknown elements are dropped.
 */
export function parseResistances(raw: string): Resistance[] | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const resistances: Resistance[] = []
  for (const entry of trimmed.split(";")) {
    const tokens = entry.trim().split(/\s+/).filter(Boolean)
    if (tokens.length < 2) continue
    const element = ELEMENT_ALIASES[tokens[0].toLowerCase().replace(/[^a-z]/g, "")]
    const percent = Number(tokens[1].replace("%", ""))
    if (!element || !Number.isFinite(percent)) continue

    const chapterOverrides: Record<number, number> = {}
    let hasOverrides = false
    for (const token of tokens.slice(2)) {
      const m = /^ch(\d+):(-?\d+(?:\.\d+)?)%?$/i.exec(token)
      if (m) {
        chapterOverrides[Number(m[1])] = Number(m[2])
        hasOverrides = true
      }
    }
    resistances.push({
      element,
      percent,
      ...(hasOverrides ? { chapterOverrides } : {}),
    })
  }
  return resistances.length > 0 ? resistances : undefined
}

export function formatResistances(
  resistances: Resistance[] | undefined,
): string {
  if (!resistances || resistances.length === 0) return ""
  return resistances
    .map((r) => {
      const overrides = r.chapterOverrides
        ? Object.entries(r.chapterOverrides)
            .map(([ch, pct]) => ` ch${ch}:${pct}`)
            .join("")
        : ""
      return `${r.element} ${r.percent}${overrides}`
    })
    .join("; ")
}
