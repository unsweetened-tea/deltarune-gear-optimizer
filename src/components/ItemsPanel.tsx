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
import { STAT_INPUT_CLASS } from "../lib/statColors"
import { Button } from "./ui/Button"
import { Card } from "./ui/Card"
import { Checkbox } from "./ui/Checkbox"
import { NumberInput, Select, TextInput } from "./ui/inputs"

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

const STAT_HEADER_CLASS: Record<keyof Stats, string> = {
  hp: "text-stat-hp",
  atk: "text-stat-atk",
  def: "text-stat-def",
  magic: "text-stat-magic",
}

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
      // Search covers name, source (for "UNCERTAIN"/"STATS NEEDED" notes),
      // and ability text so verification passes are findable.
      if (needle) {
        const haystack = [
          item.name,
          item.source ?? "",
          item.ability?.name ?? "",
          item.ability?.description ?? "",
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      if (filterChapter !== "all" && item.chapter !== filterChapter)
        return false
      if (filterType !== "all" && item.type !== filterType) return false
      return true
    })
  }, [dataset.items, search, filterChapter, filterType])

  const filtersActive =
    search.trim() !== "" || filterChapter !== "all" || filterType !== "all"

  function clearFilters() {
    setSearch("")
    setFilterChapter("all")
    setFilterType("all")
  }

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

  const headCell = "whitespace-nowrap px-2 py-2 text-left font-medium"
  const numHeadCell = "whitespace-nowrap px-2 py-2 text-right font-medium"
  const cell = "px-2 py-1.5 align-middle"

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-small text-text-muted">
          Search
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, source, ability…"
            className="w-56"
          />
        </label>
        <label className="flex flex-col gap-1 text-small text-text-muted">
          Chapter
          <Select
            value={filterChapter === "all" ? "all" : String(filterChapter)}
            onChange={(e) =>
              setFilterChapter(
                e.target.value === "all"
                  ? "all"
                  : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5),
              )
            }
          >
            <option value="all">All</option>
            {[1, 2, 3, 4, 5].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-small text-text-muted">
          Type
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "all" | ItemType)}
          >
            <option value="all">All</option>
            <option value="weapon">Weapon</option>
            <option value="armor">Armor</option>
          </Select>
        </label>
        {filtersActive && (
          <Button variant="neutral" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <Button
          variant="primary"
          onClick={addBlankItem}
          className="ml-auto"
        >
          Add item
        </Button>
      </div>

      <p className="text-small text-text-muted">
        Showing{" "}
        <span className="font-mono text-on-void">{filteredItems.length}</span>{" "}
        of <span className="font-mono">{dataset.items.length}</span> items
        {filtersActive && (
          <>
            {" · "}
            {search.trim() && <>name/source “{search.trim()}” </>}
            {filterChapter !== "all" && <>· chapter {filterChapter} </>}
            {filterType !== "all" && <>· {filterType} </>}
          </>
        )}
      </p>

      {filteredItems.length === 0 ? (
        <Card className="text-center text-small text-text-muted">
          {dataset.items.length === 0 ? (
            <p>
              No gear loaded yet — click{" "}
              <span className="font-medium text-on-surface">
                Reset to default data
              </span>{" "}
              above, or paste a wiki table in the{" "}
              <span className="font-medium text-on-surface">Import</span> tab.
            </p>
          ) : (
            <div className="space-y-3">
              <p>No items match your search or filters.</p>
              <Button variant="neutral" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </Card>
      ) : (
        /* Table — sticky header row and sticky name column */
        <div className="max-h-[70vh] overflow-auto rounded-card border border-border">
          <table className="min-w-full border-collapse text-small">
            <thead className="sticky top-0 z-20">
              <tr className="bg-surface-2 text-on-surface-2">
                <th
                  scope="col"
                  className={`sticky left-0 z-30 bg-surface-2 ${headCell}`}
                >
                  Name
                </th>
                <th scope="col" className={headCell}>
                  Type
                </th>
                <th scope="col" className={numHeadCell}>
                  Ch.
                </th>
                {STAT_KEYS.map((stat) => (
                  <th
                    key={stat}
                    scope="col"
                    className={`${numHeadCell} ${STAT_HEADER_CLASS[stat]}`}
                  >
                    {stat.toUpperCase()}
                  </th>
                ))}
                <th scope="col" className={headCell}>
                  Equippable By
                </th>
                <th scope="col" className={headCell}>
                  Excluded From
                </th>
                <th scope="col" className={headCell}>
                  Resistances
                </th>
                <th scope="col" className={headCell}>
                  Ability Name
                </th>
                <th scope="col" className={headCell}>
                  Ability Desc.
                </th>
                <th scope="col" className={numHeadCell}>
                  Owned
                </th>
                <th
                  scope="col"
                  className={headCell}
                  title="Never a candidate in any optimizer, regardless of owned — for joke/unused gear"
                >
                  Exclude
                </th>
                <th scope="col" className={headCell}>
                  Source
                </th>
                <th scope="col" className={headCell}></th>
              </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const excluded = item.excludeFromOptimizer === true
              const rowBg = excluded ? "bg-void" : "bg-surface"
              return (
                <tr
                  key={item.id}
                  className={`group border-b border-border ${rowBg} hover:bg-surface-2`}
                >
                  <td
                    className={`sticky left-0 z-10 ${rowBg} group-hover:bg-surface-2 ${cell}`}
                  >
                    <TextInput
                      value={item.name}
                      onChange={(e) =>
                        updateItem(item.id, { name: e.target.value })
                      }
                      aria-label="Item name"
                      className={`w-40 ${excluded ? "italic !text-text-muted" : ""}`}
                    />
                  </td>
                  <td className={cell}>
                    <Select
                      value={item.type}
                      onChange={(e) =>
                        updateItem(item.id, { type: e.target.value as ItemType })
                      }
                      aria-label={`${item.name} type`}
                    >
                      <option value="weapon">Weapon</option>
                      <option value="armor">Armor</option>
                    </Select>
                  </td>
                  <td className={cell}>
                    <Select
                      value={item.chapter === null ? "" : String(item.chapter)}
                      onChange={(e) =>
                        updateItem(item.id, {
                          chapter:
                            e.target.value === ""
                              ? null
                              : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5),
                        })
                      }
                      aria-label={`${item.name} chapter`}
                      title="? = chapter unknown — passes every chapter filter"
                    >
                      <option value="">?</option>
                      {[1, 2, 3, 4, 5].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </td>
                  {STAT_KEYS.map((stat) => (
                    <td key={stat} className={cell}>
                      <NumberInput
                        value={item.stats[stat]}
                        onChange={(e) =>
                          updateItemStat(
                            item.id,
                            stat,
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                        aria-label={`${item.name} ${stat.toUpperCase()}`}
                        className={`w-16 text-right ${STAT_INPUT_CLASS[stat]}`}
                      />
                    </td>
                  ))}
                  <td className={cell}>
                    <TextInput
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
                      aria-label={`${item.name} equippable by`}
                      className="w-32"
                    />
                  </td>
                  <td className={cell}>
                    <TextInput
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
                      aria-label={`${item.name} excluded from`}
                      className="w-32"
                    />
                  </td>
                  <td className={cell}>
                    <TextInput
                      key={`${item.id}-resists`}
                      defaultValue={formatResistances(item.resistances)}
                      onBlur={(e) =>
                        updateItem(item.id, {
                          resistances: parseResistances(e.target.value),
                        })
                      }
                      placeholder="puppet 35 ch5:20"
                      aria-label={`${item.name} resistances`}
                      className="w-40 font-mono text-mono"
                    />
                  </td>
                  <td className={cell}>
                    <TextInput
                      value={item.ability?.name ?? ""}
                      onChange={(e) =>
                        updateItemAbility(item.id, { name: e.target.value })
                      }
                      aria-label={`${item.name} ability name`}
                      className="w-28"
                    />
                  </td>
                  <td className={cell}>
                    <TextInput
                      value={item.ability?.description ?? ""}
                      onChange={(e) =>
                        updateItemAbility(item.id, {
                          description: e.target.value,
                        })
                      }
                      aria-label={`${item.name} ability description`}
                      className="w-48"
                    />
                  </td>
                  <td className={cell}>
                    <NumberInput
                      min={0}
                      value={item.owned}
                      onChange={(e) =>
                        updateItem(item.id, {
                          owned:
                            e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                      aria-label={`${item.name} owned count`}
                      className="w-20 text-right"
                    />
                  </td>
                  <td className={`${cell} text-center`}>
                    <Checkbox
                      checked={excluded}
                      onChange={(e) =>
                        updateItem(item.id, {
                          excludeFromOptimizer: e.target.checked || undefined,
                        })
                      }
                      aria-label={`Exclude ${item.name} from optimizer`}
                    />
                  </td>
                  <td className={cell}>
                    <TextInput
                      value={item.source ?? ""}
                      onChange={(e) =>
                        updateItem(item.id, { source: e.target.value })
                      }
                      aria-label={`${item.name} source`}
                      className="w-40"
                    />
                  </td>
                  <td className={cell}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => deleteItem(item.id, item.name)}
                      aria-label={`Delete ${item.name}`}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
