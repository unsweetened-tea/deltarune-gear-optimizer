import { useMemo, useState } from "react"
import type { Ability, Item, ItemType, Stats } from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { uniqueSlug } from "../lib/slug"
import {
  formatEquippableBy,
  formatIdList,
  parseEquippableBy,
  parseIdList,
} from "../lib/characterRefs"
import { formatResistances, parseResistances } from "../lib/resistanceFormat"

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

export function ItemsPanel() {
  const { dataset, setDataset } = useDataset()
  const [search, setSearch] = useState("")
  const [filterChapter, setFilterChapter] = useState<"all" | 1 | 2 | 3 | 4 | 5>(
    "all",
  )
  const [filterType, setFilterType] = useState<"all" | ItemType>("all")

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return dataset.items.filter((item) => {
      if (needle && !item.name.toLowerCase().includes(needle)) return false
      if (filterChapter !== "all" && item.chapter !== filterChapter)
        return false
      if (filterType !== "all" && item.type !== filterType) return false
      return true
    })
  }, [dataset.items, search, filterChapter, filterType])

  function updateItem(id: string, patch: Partial<Item>) {
    setDataset((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }))
  }

  function updateItemStat(id: string, key: keyof Stats, value: number) {
    setDataset((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === id ? { ...it, stats: { ...it.stats, [key]: value } } : it,
      ),
    }))
  }

  function updateItemAbility(id: string, patch: Partial<Ability>) {
    setDataset((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === id
          ? {
              ...it,
              ability: {
                name: it.ability?.name ?? "",
                description: it.ability?.description ?? "",
                ...patch,
              },
            }
          : it,
      ),
    }))
  }

  function deleteItem(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    setDataset((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== id),
    }))
  }

  function addBlankItem() {
    const existingIds = new Set(dataset.items.map((it) => it.id))
    const id = uniqueSlug("new-item", existingIds)
    const newItem: Item = {
      id,
      name: "New Item",
      type: "weapon",
      chapter: 1,
      stats: { hp: 0, atk: 0, def: 0, magic: 0 },
      equippableBy: "all",
      excludedFrom: [],
      owned: 1,
    }
    setDataset((prev) => ({ ...prev, items: [...prev.items, newItem] }))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-small">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="rounded border border-border bg-void px-2 py-1 text-on-void placeholder:text-text-muted"
        />
        <label className="flex items-center gap-2">
          Chapter
          <select
            value={filterChapter}
            onChange={(e) =>
              setFilterChapter(
                e.target.value === "all"
                  ? "all"
                  : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5),
              )
            }
            className="rounded border border-border bg-void px-1 py-0.5 text-on-void"
          >
            <option value="all">All</option>
            {[1, 2, 3, 4, 5].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Type
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "all" | ItemType)}
            className="rounded border border-border bg-void px-1 py-0.5 text-on-void"
          >
            <option value="all">All</option>
            <option value="weapon">Weapon</option>
            <option value="armor">Armor</option>
          </select>
        </label>
        <button
          type="button"
          onClick={addBlankItem}
          className="ml-auto rounded bg-soul px-3 py-1 font-medium text-on-soul hover:bg-soul/90"
        >
          Add item
        </button>
      </div>

      <p className="text-small text-text-muted">
        {filteredItems.length} of {dataset.items.length} item(s)
      </p>

      <div className="overflow-x-auto rounded-card border border-border bg-surface text-on-surface">
        <table className="min-w-full text-small">
          <thead className="bg-surface-2 text-on-surface-2">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Ch.</th>
              <th className="p-2 text-left text-stat-hp">HP</th>
              <th className="p-2 text-left text-stat-atk">ATK</th>
              <th className="p-2 text-left text-stat-def">DEF</th>
              <th className="p-2 text-left text-stat-magic">Magic</th>
              <th className="p-2 text-left">Equippable By</th>
              <th className="p-2 text-left">Excluded From</th>
              <th className="p-2 text-left">Resistances</th>
              <th className="p-2 text-left">Ability Name</th>
              <th className="p-2 text-left">Ability Desc.</th>
              <th className="p-2 text-left">Owned</th>
              <th
                className="p-2 text-left"
                title="Never a candidate in any optimizer, regardless of owned — for joke/unused gear"
              >
                Exclude
              </th>
              <th className="p-2 text-left">Source</th>
              <th className="p-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id} className="odd:bg-surface even:bg-surface-2">
                <td className="p-1">
                  <input
                    value={item.name}
                    onChange={(e) =>
                      updateItem(item.id, { name: e.target.value })
                    }
                    className="w-32 rounded border border-border bg-void px-1 py-0.5 text-on-void placeholder:text-text-muted"
                  />
                </td>
                <td className="p-1">
                  <select
                    value={item.type}
                    onChange={(e) =>
                      updateItem(item.id, {
                        type: e.target.value as ItemType,
                      })
                    }
                    className="rounded border border-border bg-void px-1 py-0.5 text-on-void"
                  >
                    <option value="weapon">Weapon</option>
                    <option value="armor">Armor</option>
                  </select>
                </td>
                <td className="p-1">
                  <select
                    value={item.chapter}
                    onChange={(e) =>
                      updateItem(item.id, {
                        chapter: Number(e.target.value) as
                          | 1
                          | 2
                          | 3
                          | 4
                          | 5,
                      })
                    }
                    className="rounded border border-border bg-void px-1 py-0.5 text-on-void"
                  >
                    {[1, 2, 3, 4, 5].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                {STAT_KEYS.map((stat) => (
                  <td key={stat} className="p-1">
                    <input
                      type="number"
                      value={item.stats[stat]}
                      onChange={(e) =>
                        updateItemStat(
                          item.id,
                          stat,
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                      className="w-16 rounded border border-border bg-void px-1 py-0.5 font-mono text-on-void"
                    />
                  </td>
                ))}
                <td className="p-1">
                  <input
                    key={`${item.id}-equip`}
                    defaultValue={formatEquippableBy(
                      item.equippableBy,
                      dataset.characters,
                    )}
                    onBlur={(e) =>
                      updateItem(item.id, {
                        equippableBy: parseEquippableBy(
                          e.target.value,
                          dataset.characters,
                        ),
                      })
                    }
                    placeholder="all"
                    className="w-32 rounded border border-border bg-void px-1 py-0.5 text-on-void placeholder:text-text-muted"
                  />
                </td>
                <td className="p-1">
                  <input
                    key={`${item.id}-excluded`}
                    defaultValue={formatIdList(
                      item.excludedFrom,
                      dataset.characters,
                    )}
                    onBlur={(e) =>
                      updateItem(item.id, {
                        excludedFrom: parseIdList(
                          e.target.value,
                          dataset.characters,
                        ),
                      })
                    }
                    className="w-32 rounded border border-border bg-void px-1 py-0.5 text-on-void placeholder:text-text-muted"
                  />
                </td>
                <td className="p-1">
                  <input
                    key={`${item.id}-resists`}
                    defaultValue={formatResistances(item.resistances)}
                    onBlur={(e) =>
                      updateItem(item.id, {
                        resistances: parseResistances(e.target.value),
                      })
                    }
                    placeholder="puppet 35 ch5:20"
                    className="w-40 rounded border border-border bg-void px-1 py-0.5 text-on-void placeholder:text-text-muted"
                  />
                </td>
                <td className="p-1">
                  <input
                    value={item.ability?.name ?? ""}
                    onChange={(e) =>
                      updateItemAbility(item.id, { name: e.target.value })
                    }
                    className="w-28 rounded border border-border bg-void px-1 py-0.5 text-on-void"
                  />
                </td>
                <td className="p-1">
                  <input
                    value={item.ability?.description ?? ""}
                    onChange={(e) =>
                      updateItemAbility(item.id, {
                        description: e.target.value,
                      })
                    }
                    className="w-40 rounded border border-border bg-void px-1 py-0.5 text-on-void"
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    min={0}
                    value={item.owned}
                    onChange={(e) =>
                      updateItem(item.id, {
                        owned: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className="w-16 rounded border border-border bg-void px-1 py-0.5 font-mono text-on-void"
                  />
                </td>
                <td className="p-1 text-center">
                  <input
                    type="checkbox"
                    checked={item.excludeFromOptimizer === true}
                    onChange={(e) =>
                      updateItem(item.id, {
                        excludeFromOptimizer: e.target.checked || undefined,
                      })
                    }
                    aria-label="Exclude from optimizer"
                  />
                </td>
                <td className="p-1">
                  <input
                    value={item.source ?? ""}
                    onChange={(e) =>
                      updateItem(item.id, { source: e.target.value })
                    }
                    className="w-28 rounded border border-border bg-void px-1 py-0.5 text-on-void"
                  />
                </td>
                <td className="p-1">
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id, item.name)}
                    className="rounded border border-soul/60 px-2 py-0.5 text-soul hover:bg-soul/10"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
