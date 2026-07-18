import type { Stats } from "../types/data"

/**
 * The stat color language: HP green, ATK orange, DEF blue, Magic purple.
 * Use these classes anywhere a specific stat is named or shown. This
 * multi-hue coding is deliberate — never collapse it into one accent.
 */
export const STAT_TEXT_CLASS: Record<keyof Stats, string> = {
  hp: "text-stat-hp",
  atk: "text-stat-atk",
  def: "text-stat-def",
  magic: "text-stat-magic",
}

export const STAT_BORDER_CLASS: Record<keyof Stats, string> = {
  hp: "border-stat-hp",
  atk: "border-stat-atk",
  def: "border-stat-def",
  magic: "border-stat-magic",
}

/** Inset ring to highlight one stat cell without shifting layout. */
export const STAT_RING_CLASS: Record<keyof Stats, string> = {
  hp: "ring-1 ring-inset ring-stat-hp",
  atk: "ring-1 ring-inset ring-stat-atk",
  def: "ring-1 ring-inset ring-stat-def",
  magic: "ring-1 ring-inset ring-stat-magic",
}

/**
 * Stat hue forced onto an input's own text (important, to win over a
 * primitive's default text color) — so an editable −6 Magic reads
 * purple, pairing the sign with the stat color, not color alone.
 */
export const STAT_INPUT_CLASS: Record<keyof Stats, string> = {
  hp: "!text-stat-hp",
  atk: "!text-stat-atk",
  def: "!text-stat-def",
  magic: "!text-stat-magic",
}
