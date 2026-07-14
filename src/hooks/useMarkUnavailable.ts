import { useState } from "react"
import type { Item } from "../types/data"
import { useDataset } from "./useDataset"

export interface UnavailableEntry {
  itemId: string
  itemName: string
  previousOwned: number
}

/**
 * Shared "I don't have this" behavior for every optimizer tab: sets an
 * item's owned to 0 (persisted, pruning it from the pool everywhere)
 * and keeps a reversible list of what was marked. Undo restores the
 * exact prior owned count. Re-optimization happens automatically —
 * every tab derives its result from dataset.items.
 */
export function useMarkUnavailable() {
  const { setDataset } = useDataset()
  const [recentlyUnavailable, setRecentlyUnavailable] = useState<
    UnavailableEntry[]
  >([])

  function markUnavailable(item: Item) {
    if (item.owned <= 0) return
    setRecentlyUnavailable((prev) => [
      { itemId: item.id, itemName: item.name, previousOwned: item.owned },
      ...prev,
    ])
    setDataset((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === item.id ? { ...it, owned: 0 } : it,
      ),
    }))
  }

  function undoUnavailable(entry: UnavailableEntry) {
    setDataset((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === entry.itemId ? { ...it, owned: entry.previousOwned } : it,
      ),
    }))
    setRecentlyUnavailable((prev) => prev.filter((e) => e !== entry))
  }

  return { recentlyUnavailable, markUnavailable, undoUnavailable }
}
