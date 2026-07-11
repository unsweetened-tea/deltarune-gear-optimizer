import type { Ability, Character, Item, ItemType } from "../types/data"
import { parseEquippableBy } from "./characterRefs"
import { parseResistances } from "./resistanceFormat"

const DELIMITERS = ["\t", ",", "|"] as const

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ""

  let best: string = DELIMITERS[0]
  let bestCount = -1
  for (const d of DELIMITERS) {
    const count = firstLine.split(d).length - 1
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return best
}

export function parseDelimitedText(text: string, delimiter: string): string[][] {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(delimiter).map((cell) => cell.trim()))

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
  return rows.map((row) =>
    Array.from({ length: columnCount }, (_, i) => row[i] ?? ""),
  )
}

export function parseStatValue(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  const normalized = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

export type ColumnField =
  | "ignore"
  | "name"
  | "hp"
  | "atk"
  | "def"
  | "magic"
  | "ability"
  | "equippableBy"
  | "resistances"

export const COLUMN_FIELD_OPTIONS: { value: ColumnField; label: string }[] = [
  { value: "ignore", label: "Ignore" },
  { value: "name", label: "Name" },
  { value: "hp", label: "HP" },
  { value: "atk", label: "ATK" },
  { value: "def", label: "DEF" },
  { value: "magic", label: "Magic" },
  { value: "ability", label: "Ability" },
  { value: "equippableBy", label: "Equippable By" },
  { value: "resistances", label: "Resistances" },
]

export function guessColumnField(header: string): ColumnField {
  const h = header.toLowerCase()
  if (/name/.test(h)) return "name"
  if (/hp|health/.test(h)) return "hp"
  if (/atk|attack/.test(h)) return "atk"
  if (/def(en[cs]e)?/.test(h)) return "def"
  if (/mag/.test(h)) return "magic"
  if (/resist|elem/.test(h)) return "resistances"
  if (/abil|effect|skill/.test(h)) return "ability"
  if (/equip|user|character|who/.test(h)) return "equippableBy"
  return "ignore"
}

export interface DraftItem {
  key: number
  name: string
  type: ItemType
  chapter: 1 | 2 | 3 | 4 | 5
  hp: number
  atk: number
  def: number
  magic: number
  abilityName: string
  equippableByText: string
  resistancesText: string
  skip: boolean
}

export function buildDraftItems(
  rows: string[][],
  hasHeader: boolean,
  fields: ColumnField[],
  type: ItemType,
  chapter: 1 | 2 | 3 | 4 | 5,
): DraftItem[] {
  const dataRows = hasHeader ? rows.slice(1) : rows
  const nameIdx = fields.indexOf("name")
  const hpIdx = fields.indexOf("hp")
  const atkIdx = fields.indexOf("atk")
  const defIdx = fields.indexOf("def")
  const magicIdx = fields.indexOf("magic")
  const abilityIdx = fields.indexOf("ability")
  const equipIdx = fields.indexOf("equippableBy")
  const resistIdx = fields.indexOf("resistances")

  return dataRows.map((row, i) => ({
    key: i,
    name: nameIdx >= 0 ? (row[nameIdx] ?? "") : "",
    type,
    chapter,
    hp: hpIdx >= 0 ? parseStatValue(row[hpIdx] ?? "") : 0,
    atk: atkIdx >= 0 ? parseStatValue(row[atkIdx] ?? "") : 0,
    def: defIdx >= 0 ? parseStatValue(row[defIdx] ?? "") : 0,
    magic: magicIdx >= 0 ? parseStatValue(row[magicIdx] ?? "") : 0,
    abilityName: abilityIdx >= 0 ? (row[abilityIdx] ?? "") : "",
    equippableByText: equipIdx >= 0 ? (row[equipIdx] ?? "") : "all",
    resistancesText: resistIdx >= 0 ? (row[resistIdx] ?? "") : "",
    skip: false,
  }))
}

export function draftToItem(
  row: DraftItem,
  id: string,
  characters: Character[],
  existing?: Item,
): Item {
  const abilityName = row.abilityName.trim()
  const ability: Ability | undefined = abilityName
    ? { name: abilityName, description: existing?.ability?.description ?? "" }
    : undefined

  return {
    id,
    name: row.name.trim(),
    type: row.type,
    chapter: row.chapter,
    stats: { hp: row.hp, atk: row.atk, def: row.def, magic: row.magic },
    equippableBy: parseEquippableBy(row.equippableByText, characters),
    excludedFrom: existing?.excludedFrom ?? [],
    ability,
    owned: existing?.owned ?? 0,
    source: existing?.source,
    resistances:
      parseResistances(row.resistancesText) ?? existing?.resistances,
  }
}
