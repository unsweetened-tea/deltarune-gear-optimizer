import { useState } from "react"
import type { Item, ItemType } from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { uniqueSlug, slugify } from "../lib/slug"
import {
  COLUMN_FIELD_OPTIONS,
  buildDraftItems,
  detectDelimiter,
  draftToItem,
  guessColumnField,
  parseDelimitedText,
  type ColumnField,
  type DraftItem,
} from "../lib/pasteParser"

interface PendingCollision {
  fresh: DraftItem[]
  colliding: { draft: DraftItem; existing: Item }[]
}

const DELIMITER_LABELS: Record<string, string> = {
  "\t": "Tab",
  ",": "Comma",
  "|": "Pipe",
}

export function ImportPanel() {
  const { dataset, setDataset } = useDataset()

  const [rawText, setRawText] = useState("")
  const [hasHeader, setHasHeader] = useState(true)
  const [rows, setRows] = useState<string[][]>([])
  const [delimiter, setDelimiter] = useState("")
  const [columnFields, setColumnFields] = useState<ColumnField[]>([])
  const [batchType, setBatchType] = useState<ItemType>("weapon")
  const [batchChapter, setBatchChapter] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [pendingCollision, setPendingCollision] =
    useState<PendingCollision | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function handleTextChange(text: string) {
    setRawText(text)
    setMessage(null)
    setPendingCollision(null)

    if (!text.trim()) {
      setRows([])
      setColumnFields([])
      setDraftItems([])
      setDelimiter("")
      return
    }

    const d = detectDelimiter(text)
    setDelimiter(d)
    const parsed = parseDelimitedText(text, d)
    setRows(parsed)

    const headerRow = hasHeader ? parsed[0] : undefined
    const fields = parsed[0]?.map((_, i) => guessColumnField(headerRow?.[i] ?? "")) ?? []
    setColumnFields(fields)
    setDraftItems(buildDraftItems(parsed, hasHeader, fields, batchType, batchChapter))
  }

  function handleHeaderToggle(checked: boolean) {
    setHasHeader(checked)
    setDraftItems(buildDraftItems(rows, checked, columnFields, batchType, batchChapter))
  }

  function handleColumnFieldChange(index: number, field: ColumnField) {
    const next = columnFields.map((f, i) => (i === index ? field : f))
    setColumnFields(next)
    setDraftItems(buildDraftItems(rows, hasHeader, next, batchType, batchChapter))
  }

  function handleApplyBatchDefaults() {
    setDraftItems((prev) =>
      prev.map((row) => ({ ...row, type: batchType, chapter: batchChapter })),
    )
  }

  function updateDraftRow(index: number, patch: Partial<DraftItem>) {
    setDraftItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }

  function handleCommit() {
    const validRows = draftItems.filter(
      (r) => !r.skip && r.name.trim() !== "",
    )
    if (validRows.length === 0) {
      setMessage("No valid rows to commit — each row needs a name.")
      return
    }

    const existingByName = new Map(
      dataset.items.map((it) => [it.name.trim().toLowerCase(), it]),
    )
    const fresh: DraftItem[] = []
    const colliding: { draft: DraftItem; existing: Item }[] = []

    for (const row of validRows) {
      const existing = existingByName.get(row.name.trim().toLowerCase())
      if (existing) colliding.push({ draft: row, existing })
      else fresh.push(row)
    }

    if (colliding.length > 0) {
      setPendingCollision({ fresh, colliding })
    } else {
      finalizeCommit(fresh, [], "skip")
    }
  }

  function finalizeCommit(
    fresh: DraftItem[],
    colliding: { draft: DraftItem; existing: Item }[],
    collisionChoice: "overwrite" | "skip",
  ) {
    const existingIds = new Set(dataset.items.map((it) => it.id))
    const freshItems: Item[] = fresh.map((row) => {
      const id = uniqueSlug(slugify(row.name), existingIds)
      existingIds.add(id)
      return draftToItem(row, id, dataset.characters)
    })

    let nextItems = dataset.items
    if (collisionChoice === "overwrite" && colliding.length > 0) {
      const overwriteMap = new Map(
        colliding.map(({ draft, existing }) => [
          existing.id,
          draftToItem(draft, existing.id, dataset.characters, existing),
        ]),
      )
      nextItems = nextItems.map((it) => overwriteMap.get(it.id) ?? it)
    }
    nextItems = [...nextItems, ...freshItems]

    setDataset((prev) => ({ ...prev, items: nextItems }))
    setMessage(
      `Added ${freshItems.length} item(s)` +
        (colliding.length > 0
          ? `, ${collisionChoice === "overwrite" ? "updated" : "skipped"} ${colliding.length} existing item(s).`
          : "."),
    )
    setPendingCollision(null)
    setRawText("")
    setRows([])
    setColumnFields([])
    setDraftItems([])
    setDelimiter("")
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1 block text-small font-medium text-on-void">
          Paste a table from a wiki
        </label>
        <textarea
          value={rawText}
          onChange={(e) => handleTextChange(e.target.value)}
          rows={6}
          placeholder="Paste tab/comma/pipe separated rows here..."
          className="w-full rounded-card border border-border bg-void p-2 font-mono text-mono text-on-void placeholder:text-text-muted"
        />
        {delimiter && (
          <p className="mt-1 text-small text-text-muted">
            Detected delimiter: {DELIMITER_LABELS[delimiter] ?? delimiter} ·{" "}
            {rows.length} row(s) parsed
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-small">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => handleHeaderToggle(e.target.checked)}
              />
              First row is header
            </label>

            <label className="flex items-center gap-2">
              Type
              <select
                value={batchType}
                onChange={(e) => setBatchType(e.target.value as ItemType)}
                className="rounded border border-border bg-void px-1 py-0.5 text-on-void"
              >
                <option value="weapon">Weapon</option>
                <option value="armor">Armor</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              Chapter
              <select
                value={batchChapter}
                onChange={(e) =>
                  setBatchChapter(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                }
                className="rounded border border-border bg-void px-1 py-0.5 text-on-void"
              >
                {[1, 2, 3, 4, 5].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleApplyBatchDefaults}
              className="rounded border border-soul px-2 py-1 text-soul hover:bg-soul/10"
            >
              Apply type/chapter to all rows
            </button>
          </div>

          <div>
            <h3 className="mb-2 font-display text-h2 text-on-void">
              Raw preview &amp; column mapping
            </h3>
            <div className="overflow-x-auto rounded-card border border-border bg-surface text-on-surface">
              <table className="min-w-full text-small">
                <thead className="bg-surface-2 text-on-surface-2">
                  <tr>
                    {columnFields.map((field, i) => (
                      <th key={i} className="border-b border-border p-2 text-left">
                        <select
                          value={field}
                          onChange={(e) =>
                            handleColumnFieldChange(
                              i,
                              e.target.value as ColumnField,
                            )
                          }
                          className="w-full rounded border border-border bg-void px-1 py-0.5 text-on-void"
                        >
                          {COLUMN_FIELD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {hasHeader && rows[0] && (
                          <div className="mt-1 truncate text-text-muted">
                            {rows[0][i]}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(hasHeader ? rows.slice(1) : rows).map((row, i) => (
                    <tr key={i} className="odd:bg-surface even:bg-surface-2">
                      {row.map((cell, j) => (
                        <td key={j} className="border-b border-border p-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-display text-h2 text-on-void">
              Draft items ({draftItems.length}) — edit before committing
            </h3>
            <div className="overflow-x-auto rounded-card border border-border bg-surface text-on-surface">
              <table className="min-w-full text-small">
                <thead className="bg-surface-2 text-on-surface-2">
                  <tr>
                    <th className="p-2 text-left">Skip</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Ch.</th>
                    <th className="p-2 text-left text-stat-hp">HP</th>
                    <th className="p-2 text-left text-stat-atk">ATK</th>
                    <th className="p-2 text-left text-stat-def">DEF</th>
                    <th className="p-2 text-left text-stat-magic">Magic</th>
                    <th className="p-2 text-left">Ability</th>
                    <th className="p-2 text-left">Equippable By</th>
                    <th className="p-2 text-left">Resists</th>
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((row, i) => (
                    <tr
                      key={row.key}
                      className={
                        row.name.trim() === "" && !row.skip
                          ? "bg-soul/10"
                          : "odd:bg-surface even:bg-surface-2"
                      }
                    >
                      <td className="p-1">
                        <input
                          type="checkbox"
                          checked={row.skip}
                          onChange={(e) =>
                            updateDraftRow(i, { skip: e.target.checked })
                          }
                        />
                      </td>
                      <td className="p-1">
                        <input
                          value={row.name}
                          onChange={(e) =>
                            updateDraftRow(i, { name: e.target.value })
                          }
                          className="w-32 rounded border border-border bg-void px-1 py-0.5 text-on-void placeholder:text-text-muted"
                        />
                      </td>
                      <td className="p-1">
                        <select
                          value={row.type}
                          onChange={(e) =>
                            updateDraftRow(i, {
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
                          value={row.chapter}
                          onChange={(e) =>
                            updateDraftRow(i, {
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
                      {(["hp", "atk", "def", "magic"] as const).map((stat) => (
                        <td key={stat} className="p-1">
                          <input
                            type="number"
                            value={row[stat]}
                            onChange={(e) =>
                              updateDraftRow(i, {
                                [stat]:
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value),
                              })
                            }
                            className="w-16 rounded border border-border bg-void px-1 py-0.5 font-mono text-on-void"
                          />
                        </td>
                      ))}
                      <td className="p-1">
                        <input
                          value={row.abilityName}
                          onChange={(e) =>
                            updateDraftRow(i, { abilityName: e.target.value })
                          }
                          className="w-32 rounded border border-border bg-void px-1 py-0.5 text-on-void placeholder:text-text-muted"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          value={row.equippableByText}
                          onChange={(e) =>
                            updateDraftRow(i, {
                              equippableByText: e.target.value,
                            })
                          }
                          placeholder="all"
                          className="w-32 rounded border border-border bg-void px-1 py-0.5 text-on-void placeholder:text-text-muted"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          value={row.resistancesText}
                          onChange={(e) =>
                            updateDraftRow(i, {
                              resistancesText: e.target.value,
                            })
                          }
                          placeholder="puppet 35 ch5:20"
                          className="w-40 rounded border border-border bg-void px-1 py-0.5 text-on-void placeholder:text-text-muted"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pendingCollision && (
            <div className="rounded-card border border-warning/60 bg-surface p-4 text-small text-on-surface">
              <p className="font-medium">
                {pendingCollision.colliding.length} item(s) already exist:{" "}
                {pendingCollision.colliding
                  .map((c) => c.existing.name)
                  .join(", ")}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    finalizeCommit(
                      pendingCollision.fresh,
                      pendingCollision.colliding,
                      "overwrite",
                    )
                  }
                  className="rounded bg-warning px-3 py-1 font-medium text-on-warning hover:bg-warning/90"
                >
                  Overwrite existing
                </button>
                <button
                  type="button"
                  onClick={() =>
                    finalizeCommit(
                      pendingCollision.fresh,
                      pendingCollision.colliding,
                      "skip",
                    )
                  }
                  className="rounded border border-warning/60 px-3 py-1 text-warning hover:bg-warning/10"
                >
                  Skip these
                </button>
                <button
                  type="button"
                  onClick={() => setPendingCollision(null)}
                  className="rounded border border-border px-3 py-1 text-on-surface hover:bg-surface-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleCommit}
            disabled={draftItems.length === 0 || pendingCollision !== null}
            className="rounded bg-soul px-4 py-2 text-small font-medium text-on-soul hover:bg-soul/90 disabled:opacity-50"
          >
            Commit {draftItems.filter((r) => !r.skip).length} item(s) to
            dataset
          </button>
        </>
      )}

      {message && <p className="text-small text-success">{message}</p>}
    </div>
  )
}
