import type { ChapterGate, Character } from "../types/data"
import { slugify } from "./slug"

const CHAPTERS = [1, 2, 3, 4, 5] as const

function resolveToId(name: string, characters: Character[]): string {
  const match = characters.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  )
  return match ? match.id : slugify(name)
}

/**
 * Compact text format for editing story gates in a table cell:
 *   "Susie ch5; Noelle ch3"
 * = [{ characterIds: ["susie"], fromChapter: 5 }, …]
 * Entries are ";"-separated; each is one or more comma-separated
 * character names followed by `ch<N>`. Entries without a valid chapter
 * are dropped. Any `note` already on a gate is preserved by
 * formatChapterGates → parseChapterGates round-trips losing it, so the
 * caller merges notes back in.
 */
export function parseChapterGates(
  raw: string,
  characters: Character[],
): ChapterGate[] | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const gates: ChapterGate[] = []
  for (const entry of trimmed.split(";")) {
    const tokens = entry.trim().split(/\s+/).filter(Boolean)
    if (tokens.length < 2) continue

    const chapterToken = tokens[tokens.length - 1]
    const m = /^ch(\d)$/i.exec(chapterToken)
    if (!m) continue
    const chapter = Number(m[1])
    if (!CHAPTERS.includes(chapter as (typeof CHAPTERS)[number])) continue

    const names = tokens
      .slice(0, -1)
      .join(" ")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.length === 0) continue

    gates.push({
      characterIds: names.map((name) => resolveToId(name, characters)),
      fromChapter: chapter as ChapterGate["fromChapter"],
    })
  }
  return gates.length > 0 ? gates : undefined
}

export function formatChapterGates(
  gates: ChapterGate[] | undefined,
  characters: Character[],
): string {
  if (!gates || gates.length === 0) return ""
  return gates
    .map((gate) => {
      const names = gate.characterIds
        .map((id) => characters.find((c) => c.id === id)?.name ?? id)
        .join(", ")
      return `${names} ch${gate.fromChapter}`
    })
    .join("; ")
}

/**
 * Re-attaches the human-written notes from the previous gates to freshly
 * parsed ones (matched on chapter + character set), so editing the text
 * field doesn't silently drop an explanation the user never saw.
 */
export function preserveGateNotes(
  parsed: ChapterGate[] | undefined,
  previous: ChapterGate[] | undefined,
): ChapterGate[] | undefined {
  if (!parsed || !previous) return parsed
  return parsed.map((gate) => {
    const match = previous.find(
      (p) =>
        p.fromChapter === gate.fromChapter &&
        p.characterIds.length === gate.characterIds.length &&
        p.characterIds.every((id) => gate.characterIds.includes(id)),
    )
    return match?.note ? { ...gate, note: match.note } : gate
  })
}
