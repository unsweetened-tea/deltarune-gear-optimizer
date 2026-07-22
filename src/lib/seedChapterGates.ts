import type { ChapterGate, Item } from "../types/data"

/**
 * Story gates the bundled seed can't carry itself (gearData.json is
 * treated as read-only wiki data), applied once when a pre-v4 dataset is
 * migrated. Keyed by item id.
 *
 * These are starting values, not rules: they live on the item as ordinary
 * `chapterGates` data and are editable in the gear table like any other
 * field. Nothing in the optimizers knows what a ribbon is.
 */
const SEED_CHAPTER_GATES: Record<string, ChapterGate[]> = Object.fromEntries(
  [
    "white-ribbon",
    "pink-ribbon",
    "twin-ribbon",
    "blue-ribbon",
    "redribbon",
    "princessrbn",
    "monarchrbn",
  ].map((id) => [
    id,
    [
      {
        characterIds: ["susie"],
        fromChapter: 5,
        note: "Susie only wears ribbons partway through Chapter 5",
      },
    ] satisfies ChapterGate[],
  ]),
)

/**
 * Adds the seed gates to items that have none. An item that already
 * carries gates — because the user edited it — is left alone.
 */
export function applySeedChapterGates(items: Item[]): Item[] {
  return items.map((item) => {
    if (item.chapterGates !== undefined) return item
    const gates = SEED_CHAPTER_GATES[item.id]
    return gates ? { ...item, chapterGates: gates.map((g) => ({ ...g })) } : item
  })
}
