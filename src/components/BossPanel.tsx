import { useState } from "react"
import type {
  Boss,
  BossSpecialRule,
  Element,
  Item,
  WinCondition,
} from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { optimizeVsBoss } from "../lib/bossOptimizer"
import { seedSpecialRulesFor } from "../lib/bossRules"
import { ELEMENT_LABELS, ELEMENTS } from "../lib/resistanceFormat"
import { STAT_TEXT_CLASS } from "../lib/statColors"
import { slugify, uniqueSlug } from "../lib/slug"
import { SoulHeart } from "./SoulHeart"

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const
const PROFILE_KEYS: (Exclude<Element, "all"> | "neutral")[] = [
  ...ELEMENTS,
  "neutral",
]

const inputClass =
  "rounded border border-border bg-void px-2 py-1 text-on-void placeholder:text-text-muted"

export function BossPanel({
  onMarkUnavailable,
}: {
  onMarkUnavailable: (item: Item) => void
}) {
  const { dataset, setDataset } = useDataset()
  const [selectedBossId, setSelectedBossId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newChapter, setNewChapter] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)

  const boss =
    dataset.bosses.find((b) => b.id === selectedBossId) ??
    dataset.bosses[0] ??
    null
  const party = dataset.characters.filter((c) => c.active)
  const { chaptersEnabled, inventoryMode } = dataset.settings

  const result =
    boss && party.length > 0 && dataset.items.length > 0
      ? optimizeVsBoss({
          boss,
          party,
          items: dataset.items,
          chaptersEnabled,
          inventoryMode,
        })
      : null

  function updateBoss(id: string, patch: Partial<Boss>) {
    setDataset((prev) => ({
      ...prev,
      bosses: prev.bosses.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))
  }

  function deleteBoss(id: string) {
    setDataset((prev) => ({
      ...prev,
      bosses: prev.bosses.filter((b) => b.id !== id),
    }))
  }

  function addBoss() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const id = uniqueSlug(
      `boss-${slugify(trimmed)}`,
      new Set(dataset.bosses.map((b) => b.id)),
    )
    const seededRules = seedSpecialRulesFor(trimmed)
    const created: Boss = {
      id,
      name: trimmed,
      chapter: newChapter,
      damageProfile: { neutral: 1 },
      winCondition: "fight",
      ...(seededRules.length > 0 ? { specialRules: seededRules } : {}),
    }
    setDataset((prev) => ({ ...prev, bosses: [...prev.bosses, created] }))
    setSelectedBossId(id)
    setEditorOpen(true)
    setNewName("")
  }

  const profileSum = boss
    ? PROFILE_KEYS.reduce((acc, k) => acc + (boss.damageProfile[k] ?? 0), 0)
    : 0

  return (
    <div className="space-y-6">
      <p className="text-small text-text-muted">
        A boss entry is a <span className="text-on-void">hypothesis</span>,
        not game data — nothing publishes &quot;Pink deals 70%
        Puppet/Cat&quot;. Encode your best estimate of each element&apos;s
        damage share, then refine it after a fight.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {dataset.bosses.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelectedBossId(b.id)}
            className={
              "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-small font-medium " +
              (boss?.id === b.id
                ? "border-soul bg-soul text-on-soul"
                : "border-border text-text-muted hover:border-soul hover:text-on-void")
            }
          >
            {boss?.id === b.id && <SoulHeart className="h-2.5 w-2.5" />}
            {b.name}
          </button>
        ))}

        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Boss name"
            className={`w-36 ${inputClass}`}
          />
          <label className="flex items-center gap-1 text-small text-text-muted">
            Ch.
            <input
              type="number"
              min={1}
              value={newChapter}
              onChange={(e) => setNewChapter(Number(e.target.value) || 1)}
              className={`w-14 font-mono ${inputClass}`}
            />
          </label>
          <button
            type="button"
            onClick={addBoss}
            disabled={!newName.trim()}
            className="rounded bg-soul px-3 py-1 text-small font-medium text-on-soul hover:bg-soul/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add boss
          </button>
        </div>
      </div>

      {!boss && (
        <p className="rounded-card border border-border bg-surface p-6 text-center text-small text-text-muted">
          No bosses yet. Add one above — you define its damage profile
          yourself; these are saved hypotheses, not combat simulations.
        </p>
      )}

      {boss && (
        <>
          <div className="rounded-card border border-border bg-surface p-3 text-small text-on-surface">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-h2">{boss.name}</span>
              <span className="font-mono text-mono text-text-muted">
                Ch. {boss.chapter}
              </span>
              <span className="rounded bg-surface-2 px-2 py-0.5 text-mono font-mono text-on-surface-2">
                {boss.winCondition}
              </span>
              {boss.winCondition !== "fight" && (
                <span className="text-text-muted">
                  ATK is irrelevant for this win condition and is ignored.
                </span>
              )}
              <span className="text-text-muted">
                {PROFILE_KEYS.filter((k) => (boss.damageProfile[k] ?? 0) > 0)
                  .map(
                    (k) =>
                      `${Math.round((boss.damageProfile[k] ?? 0) * 100)}% ${ELEMENT_LABELS[k]}`,
                  )
                  .join(" · ") || "no damage profile set"}
              </span>
              <button
                type="button"
                onClick={() => setEditorOpen((v) => !v)}
                className="ml-auto rounded border border-border px-2 py-0.5 text-small text-on-surface hover:bg-surface-2"
              >
                {editorOpen ? "Close editor" : "Edit boss"}
              </button>
            </div>
            {boss.notes && (
              <p className="mt-1 text-small text-text-muted">{boss.notes}</p>
            )}
          </div>

          {editorOpen && (
            <BossEditor
              boss={boss}
              profileSum={profileSum}
              updateBoss={updateBoss}
              deleteBoss={(id) => {
                deleteBoss(id)
                setEditorOpen(false)
              }}
            />
          )}

          {dataset.items.length === 0 ? (
            <p className="rounded-card border border-border bg-surface p-6 text-center text-small text-text-muted">
              No items in your dataset yet — import gear first, then come
              back for counter-gear recommendations.
            </p>
          ) : result && !result.ok ? (
            <p className="rounded-card border border-warning/60 bg-surface p-4 text-small text-on-surface">
              <span className="font-semibold text-warning">
                Can&apos;t optimize:{" "}
              </span>
              {result.reason}
            </p>
          ) : result?.ok ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {result.assignments.map((a) => (
                  <div
                    key={a.character.id}
                    className="rounded-card border border-border bg-surface p-4 text-on-surface"
                  >
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-display text-h2">
                        {a.character.name}
                      </h3>
                      <span
                        className="font-mono text-h2 font-bold"
                        title="Elemental damage multiplier incl. special rules — 1.00 means unresisted"
                      >
                        ×{a.damageMultiplier.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-small text-text-muted">
                      takes ~{Math.round(a.perHit)} per nominal 100 hit
                    </p>

                    <ul className="mt-2 space-y-1 text-small">
                      <li className="flex items-center gap-2">
                        <span>
                          <span className="text-text-muted">Weapon:</span>{" "}
                          {a.weapon.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => onMarkUnavailable(a.weapon)}
                          className="rounded border border-soul/60 px-2 py-0.5 text-small text-soul hover:bg-soul/10"
                        >
                          I don&apos;t have this
                        </button>
                      </li>
                      {a.armor.map((piece, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span>
                            <span className="text-text-muted">Armor:</span>{" "}
                            {piece.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => onMarkUnavailable(piece)}
                            className="rounded border border-soul/60 px-2 py-0.5 text-small text-soul hover:bg-soul/10"
                          >
                            I don&apos;t have this
                          </button>
                        </li>
                      ))}
                      {a.armor.length === 0 && (
                        <li className="text-text-muted">Armor: (none)</li>
                      )}
                    </ul>

                    {a.why.length > 0 && (
                      <ul className="mt-2 space-y-1 rounded-card border border-border bg-surface-2 p-2 text-small text-on-surface-2">
                        {a.why.map((w, i) => (
                          <li key={i}>
                            <span className="font-medium">{w.itemName}:</span>{" "}
                            {w.text}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 flex gap-2">
                      {STAT_KEYS.map((stat) => (
                        <div
                          key={stat}
                          className="rounded bg-surface-2 px-2 py-1 text-center text-on-surface-2"
                        >
                          <div
                            className={`text-small font-medium uppercase ${STAT_TEXT_CLASS[stat]}`}
                          >
                            {stat}
                          </div>
                          <div
                            className={`font-mono text-mono font-bold ${STAT_TEXT_CLASS[stat]}`}
                          >
                            {a.totals[stat]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {result.blocked.map((b) => (
                  <div
                    key={b.character.id}
                    className="rounded-card border border-warning/60 bg-surface p-4 text-on-surface"
                  >
                    <h3 className="font-display text-h2">
                      {b.character.name}
                    </h3>
                    <ul className="mt-2 space-y-1 text-small">
                      <li>
                        <span className="text-text-muted">
                          {b.reason.toLowerCase().includes("weapon")
                            ? "Weapon:"
                            : "Armor:"}
                        </span>{" "}
                        <span className="text-warning">(none available)</span>
                      </li>
                    </ul>
                    <p className="mt-2 text-small text-warning">{b.reason}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="mb-2 font-display text-h2 text-on-void">
                  Items considered
                </h3>
                <div className="overflow-x-auto rounded-card border border-border bg-surface text-on-surface">
                  <table className="min-w-full text-small">
                    <thead className="bg-surface-2 text-on-surface-2">
                      <tr>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-left">Verdict</th>
                        <th className="p-2 text-left">Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...result.verdicts]
                        .sort(
                          (a, b) =>
                            Number(b.used) - Number(a.used) ||
                            a.item.name.localeCompare(b.item.name),
                        )
                        .map((v) => (
                          <tr
                            key={v.item.id}
                            className="odd:bg-surface even:bg-surface-2"
                          >
                            <td className="p-2">{v.item.name}</td>
                            <td className="p-2">
                              {v.used ? (
                                <span className="font-medium text-success">
                                  picked — {v.usedBy}
                                </span>
                              ) : (
                                <span className="text-text-muted">
                                  rejected
                                </span>
                              )}
                            </td>
                            <td className="p-2">
                              {v.reasons.join("; ") || "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {inventoryMode === "owned" && result.leftovers.length > 0 && (
                <div>
                  <h3 className="mb-1 font-display text-h2 text-on-void">
                    Leftover inventory
                  </h3>
                  <ul className="text-small text-on-void">
                    {result.leftovers.map(({ item, unused }) => (
                      <li key={item.id}>
                        {item.name}{" "}
                        <span className="font-mono text-mono text-text-muted">
                          × {unused}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  )
}

function BossEditor({
  boss,
  profileSum,
  updateBoss,
  deleteBoss,
}: {
  boss: Boss
  profileSum: number
  updateBoss: (id: string, patch: Partial<Boss>) => void
  deleteBoss: (id: string) => void
}) {
  const { dataset } = useDataset()

  function updateRule(index: number, patch: Partial<BossSpecialRule>) {
    const rules = (boss.specialRules ?? []).map((r, i) =>
      i === index ? { ...r, ...patch } : r,
    )
    updateBoss(boss.id, { specialRules: rules })
  }

  function addRule() {
    updateBoss(boss.id, {
      specialRules: [
        ...(boss.specialRules ?? []),
        { itemName: "", flatReduction: 0.5 },
      ],
    })
  }

  function removeRule(index: number) {
    const rules = (boss.specialRules ?? []).filter((_, i) => i !== index)
    updateBoss(boss.id, {
      specialRules: rules.length > 0 ? rules : undefined,
    })
  }

  return (
    <div className="space-y-3 rounded-card border border-dashed border-border p-3 text-small text-on-void">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={boss.name}
          onChange={(e) => updateBoss(boss.id, { name: e.target.value })}
          className={`w-40 ${inputClass}`}
          aria-label="Boss name"
        />
        <label className="flex items-center gap-1 text-text-muted">
          Chapter
          <input
            type="number"
            min={1}
            value={boss.chapter}
            onChange={(e) =>
              updateBoss(boss.id, { chapter: Number(e.target.value) || 1 })
            }
            className={`w-14 font-mono ${inputClass}`}
          />
        </label>
        <label className="flex items-center gap-1 text-text-muted">
          Win by
          <select
            value={boss.winCondition}
            onChange={(e) =>
              updateBoss(boss.id, {
                winCondition: e.target.value as WinCondition,
              })
            }
            className={inputClass}
          >
            <option value="fight">fight</option>
            <option value="spare">spare</option>
            <option value="special">special</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => deleteBoss(boss.id)}
          className="ml-auto rounded border border-soul/60 px-2 py-1 text-small text-soul hover:bg-soul/10"
        >
          Delete boss
        </button>
      </div>

      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="sr-only">Damage profile</legend>
        <span className="text-text-muted">Damage shares</span>
        {PROFILE_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-1">
            {ELEMENT_LABELS[key]}
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={boss.damageProfile[key] ?? 0}
              onChange={(e) =>
                updateBoss(boss.id, {
                  damageProfile: {
                    ...boss.damageProfile,
                    [key]:
                      e.target.value === "" ? 0 : Number(e.target.value),
                  },
                })
              }
              className={`w-16 font-mono ${inputClass}`}
            />
          </label>
        ))}
        <span
          className={
            Math.abs(profileSum - 1) > 0.05
              ? "font-mono text-warning"
              : "font-mono text-text-muted"
          }
        >
          Σ {profileSum.toFixed(2)}
          {Math.abs(profileSum - 1) > 0.05 ? " (should be ~1)" : ""}
        </span>
      </fieldset>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-text-muted">
            Special rules (attacks that bypass elements)
          </span>
          <button
            type="button"
            onClick={addRule}
            className="rounded border border-border px-2 py-0.5 text-small text-on-void hover:bg-surface-2"
          >
            Add rule
          </button>
        </div>
        {(boss.specialRules ?? []).map((rule, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={rule.itemName}
              onChange={(e) => updateRule(i, { itemName: e.target.value })}
              placeholder="Item name (e.g. Shadow Mantle)"
              className={`w-52 ${inputClass}`}
            />
            <select
              value={rule.requiredCharacterId ?? ""}
              onChange={(e) =>
                updateRule(i, {
                  requiredCharacterId: e.target.value || undefined,
                })
              }
              className={inputClass}
            >
              <option value="">any character</option>
              {dataset.characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} only
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-text-muted">
              cuts damage
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(rule.flatReduction * 100)}
                onChange={(e) =>
                  updateRule(i, {
                    flatReduction:
                      Math.min(100, Math.max(0, Number(e.target.value) || 0)) /
                      100,
                  })
                }
                className={`w-16 font-mono ${inputClass}`}
              />
              %
            </label>
            <button
              type="button"
              onClick={() => removeRule(i)}
              className="rounded border border-soul/60 px-2 py-0.5 text-small text-soul hover:bg-soul/10"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <input
        value={boss.notes ?? ""}
        onChange={(e) =>
          updateBoss(boss.id, { notes: e.target.value || undefined })
        }
        placeholder="Notes (what does this fight actually do?)"
        className={`w-full ${inputClass}`}
      />
    </div>
  )
}
