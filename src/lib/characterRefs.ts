import type { Character } from "../types/data"
import { slugify } from "./slug"

function resolveToId(name: string, characters: Character[]): string {
  const match = characters.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  )
  return match ? match.id : slugify(name)
}

export function parseEquippableBy(
  raw: string,
  characters: Character[],
): "all" | string[] {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.toLowerCase() === "all") return "all"

  const names = trimmed
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (names.length === 0) return "all"

  return names.map((name) => resolveToId(name, characters))
}

export function parseIdList(raw: string, characters: Character[]): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  return trimmed
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => resolveToId(name, characters))
}

export function formatEquippableBy(
  value: "all" | string[],
  characters: Character[],
): string {
  if (value === "all") return "all"
  return value
    .map((id) => characters.find((c) => c.id === id)?.name ?? id)
    .join(", ")
}

export function formatIdList(
  value: string[],
  characters: Character[],
): string {
  return value
    .map((id) => characters.find((c) => c.id === id)?.name ?? id)
    .join(", ")
}
