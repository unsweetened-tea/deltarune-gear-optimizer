import type { PresetCategory } from "../types/data"

export type Tab =
  | "home"
  | "optimize"
  | "solo"
  | "import"
  | "items"
  | "characters"
  | "style"
  | "about"

export interface Route {
  tab: Tab
  /** Which Optimize sub-tab opens on entry; ignored by every other tab. */
  optimizeCategory: PresetCategory
}

const TAB_IDS: Tab[] = [
  "home",
  "optimize",
  "solo",
  "import",
  "items",
  "characters",
  "style",
  "about",
]

/** URL segment ⇄ Optimize sub-tab, so "counter a boss" is deep-linkable. */
const CATEGORY_SEGMENTS: Record<string, PresetCategory> = {
  playstyle: "playstyle",
  stat: "stat",
  bosses: "boss",
}

const SEGMENT_BY_CATEGORY: Record<PresetCategory, string> = {
  playstyle: "playstyle",
  stat: "stat",
  boss: "bosses",
}

export const HOME_ROUTE: Route = { tab: "home", optimizeCategory: "playstyle" }

/**
 * Hash routing (not the History API) so the static build deep-links without
 * a server-side SPA fallback. "/" — i.e. no hash — is Home; anything
 * unrecognized also lands on Home rather than a dead screen.
 */
export function parseRoute(hash: string): Route {
  const [rawTab, rawSub] = hash
    .replace(/^#/, "")
    .replace(/^\//, "")
    .split("/")

  const tab = TAB_IDS.find((id) => id === rawTab)
  if (!tab) return HOME_ROUTE

  return {
    tab,
    optimizeCategory:
      (rawSub && CATEGORY_SEGMENTS[rawSub]) || HOME_ROUTE.optimizeCategory,
  }
}

/** The href/hash for a tab — pair with parseRoute, never hand-write hashes. */
export function routeHref(tab: Tab, optimizeCategory?: PresetCategory): string {
  if (tab === "home") return "#/"
  if (tab === "optimize" && optimizeCategory && optimizeCategory !== "playstyle")
    return `#/optimize/${SEGMENT_BY_CATEGORY[optimizeCategory]}`
  return `#/${tab}`
}
