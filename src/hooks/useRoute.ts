import { useEffect, useState } from "react"
import type { PresetCategory } from "../types/data"
import type { Route, Tab } from "../lib/routes"
import { parseRoute, routeHref } from "../lib/routes"

/**
 * The app's whole router: the location hash is the single source of truth for
 * which screen is showing, so every screen is deep-linkable and Back works.
 */
export function useRoute(): {
  route: Route
  navigate: (tab: Tab, optimizeCategory?: PresetCategory) => void
} {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  return {
    route: parseRoute(hash),
    navigate: (tab, optimizeCategory) => {
      const next = routeHref(tab, optimizeCategory)
      if (window.location.hash === next) return
      window.location.hash = next
    },
  }
}
