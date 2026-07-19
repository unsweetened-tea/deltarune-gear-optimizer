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
import { STAT_INPUT_CLASS } from "../lib/statColors"
import { Button } from "./ui/Button"
import { Card } from "./ui/Card"
import { Checkbox } from "./ui/Checkbox"
import { NumberInput, Select, Textarea, TextInput } from "./ui/inputs"

const STAT_HEAD: Record<"hp" | "atk" | "def" | "magic", string> = {
  hp: "text-stat-hp",
  atk: "text-stat-atk",
  def: "text-stat-def",
  magic: "text-stat-magic",
}

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
        <Textarea
          value={rawText}
          onChange={(e) => handleTextChange(e.target.value)}
          rows={6}
          placeholder="Paste tab / comma / pipe separated rows here…"
          className="w-full"
        />
        {delimiter && rows.length > 0 && (
          <p className="mt-1 text-small text-text-muted">
            Detected delimiter:{" "}
            <span className="font-medium text-on-void">
              {DELIMITER_LABELS[delimiter] ?? delimiter}
            </span>{" "}
            · <span className="font-mono">{rows.length}</span> row(s) parsed
          </p>
        )}
        {rawText.trim() === "" ? (
          <p className="mt-2 text-small text-text-muted">
            Copy a gear table from the wiki and paste it above — tab, comma, or
            pipe separated. Keep the header row; you&apos;ll map columns and
            edit rows before committing.
          </p>
        ) : (
          rows.length === 0 && (
            <p className="mt-2 text-small text-warning">
              Couldn&apos;t find any rows to parse. Check that cells are
              separated by tabs, commas, or pipes.
            </p>
          )
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-4 text-small">
            <Checkbox
              label="First row is header"
              checked={hasHeader}
              onChange={(e) => handleHeaderToggle(e.target.checked)}
            />

            <label className="flex flex-col gap-1 text-text-muted">
              Type (applied to all)
              <Select
                value={batchType}
                onChange={(e) => setBatchType(e.target.value as ItemType)}
              >
                <option value="weapon">Weapon</option>
                <option value="armor">Armor</option>
              </Select>
            </label>

            <label className="flex flex-col gap-1 text-text-muted">
              Chapter (applied to all)
              <Select
                value={batchChapter}
                onChange={(e) =>
                  setBatchChapter(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                }
              >
                {[1, 2, 3, 4, 5].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </label>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleApplyBatchDefaults}
            >
              Apply type/chapter to all rows
            </Button>
          </div>

          <div>
            <h3 className="font-display text-h2 text-on-void">
              Raw preview &amp; column mapping
            </h3>
            <p className="mb-2 text-small text-text-muted">
              Assign each column below. Columns left on{" "}
              <span className="font-medium">Ignore</span> are muted and won&apos;t
              be imported.
            </p>
            <div className="overflow-x-auto rounded-card border border-border bg-surface text-on-surface">
              <table className="min-w-full text-small">
                <thead className="bg-surface-2 text-on-surface-2">
                  <tr>
                    {columnFields.map((field, i) => {
                      const ignored = field === "ignore"
                      return (
                        <th
                          key={i}
                          className={`border-b border-border p-2 text-left align-top ${
                            ignored ? "opacity-60" : ""
                          }`}
                        >
                          <Select
                            value={field}
                            onChange={(e) =>
                              handleColumnFieldChange(
                                i,
                                e.target.value as ColumnField,
                              )
                            }
                            className={`w-full ${ignored ? "" : "!text-soul"}`}
                          >
                            {COLUMN_FIELD_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                          {hasHeader && rows[0] && (
                            <div className="mt-1 max-w-40 truncate text-text-muted">
                              {rows[0][i] || "—"}
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(hasHeader ? rows.slice(1) : rows).map((row, i) => (
                    <tr key={i} className="odd:bg-surface even:bg-surface-2">
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className={`border-b border-border px-2 py-1.5 ${
                            columnFields[j] === "ignore"
                              ? "text-text-muted"
                              : ""
                          }`}
                        >
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
            <h3 className="font-display text-h2 text-on-void">
              Draft items ({draftItems.length}) — edit before committing
            </h3>
            <p className="mb-2 text-small text-text-muted">
              Rows tinted red need a name before they can commit.
            </p>
            <div className="overflow-x-auto rounded-card border border-border bg-surface text-on-surface">
              <table className="min-w-full text-small">
                <thead className="bg-surface-2 text-on-surface-2">
                  <tr>
                    <th className="whitespace-nowrap px-2 py-2 text-left">
                      Skip
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-left">
                      Name
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-left">
                      Type
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-right">
                      Ch.
                    </th>
                    {(["hp", "atk", "def", "magic"] as const).map((s) => (
                      <th
                        key={s}
                        className={`whitespace-nowrap px-2 py-2 text-right ${STAT_HEAD[s]}`}
                      >
                        {s.toUpperCase()}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-2 py-2 text-left">
                      Ability
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-left">
                      Equippable By
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-left">
                      Resists
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((row, i) => {
                    const invalid = row.name.trim() === "" && !row.skip
                    return (
                      <tr
                        key={row.key}
                        className={
                          invalid
                            ? "bg-soul/10"
                            : "border-b border-border hover:bg-surface-2"
                        }
                      >
                        <td className="px-2 py-1.5 text-center">
                          <Checkbox
                            checked={row.skip}
                            onChange={(e) =>
                              updateDraftRow(i, { skip: e.target.checked })
                            }
                            aria-label={`Skip row ${i + 1}`}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <TextInput
                            value={row.name}
                            onChange={(e) =>
                              updateDraftRow(i, { name: e.target.value })
                            }
                            className="w-32"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select
                            value={row.type}
                            onChange={(e) =>
                              updateDraftRow(i, {
                                type: e.target.value as ItemType,
                              })
                            }
                          >
                            <option value="weapon">Weapon</option>
                            <option value="armor">Armor</option>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Select
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
                          >
                            {[1, 2, 3, 4, 5].map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </Select>
                        </td>
                        {(["hp", "atk", "def", "magic"] as const).map((stat) => (
                          <td key={stat} className="px-2 py-1.5">
                            <NumberInput
                              value={row[stat]}
                              onChange={(e) =>
                                updateDraftRow(i, {
                                  [stat]:
                                    e.target.value === ""
                                      ? 0
                                      : Number(e.target.value),
                                })
                              }
                              className={`w-16 text-right ${STAT_INPUT_CLASS[stat]}`}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5">
                          <TextInput
                            value={row.abilityName}
                            onChange={(e) =>
                              updateDraftRow(i, { abilityName: e.target.value })
                            }
                            className="w-32"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <TextInput
                            value={row.equippableByText}
                            onChange={(e) =>
                              updateDraftRow(i, {
                                equippableByText: e.target.value,
                              })
                            }
                            placeholder="all"
                            className="w-32"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <TextInput
                            value={row.resistancesText}
                            onChange={(e) =>
                              updateDraftRow(i, {
                                resistancesText: e.target.value,
                              })
                            }
                            placeholder="puppet 35 ch5:20"
                            className="w-40 font-mono text-mono"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {pendingCollision && (
            <Card tone="warning" className="text-small">
              <p className="font-medium">
                <span className="text-warning">
                  {pendingCollision.colliding.length} item(s) already exist:
                </span>{" "}
                {pendingCollision.colliding
                  .map((c) => c.existing.name)
                  .join(", ")}
              </p>
              <p className="mt-1 text-text-muted">
                Overwrite replaces the existing entries; Skip keeps them and
                imports only the new items.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="warning"
                  size="sm"
                  onClick={() =>
                    finalizeCommit(
                      pendingCollision.fresh,
                      pendingCollision.colliding,
                      "overwrite",
                    )
                  }
                >
                  Overwrite existing
                </Button>
                <Button
                  variant="warning"
                  size="sm"
                  onClick={() =>
                    finalizeCommit(
                      pendingCollision.fresh,
                      pendingCollision.colliding,
                      "skip",
                    )
                  }
                >
                  Skip these
                </Button>
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={() => setPendingCollision(null)}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          <Button
            variant="primary"
            onClick={handleCommit}
            disabled={draftItems.length === 0 || pendingCollision !== null}
          >
            Commit {draftItems.filter((r) => !r.skip).length} item(s) to
            dataset
          </Button>
        </>
      )}

      {message && <p className="text-small text-success">{message}</p>}
    </div>
  )
}
