import type { Character, CharacterSlots, Stats } from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { STAT_TEXT_CLASS } from "../lib/statColors"

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

export function CharactersPanel() {
  const { dataset, setDataset } = useDataset()

  function updateCharacter(id: string, patch: Partial<Character>) {
    setDataset((prev) => ({
      ...prev,
      characters: prev.characters.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    }))
  }

  function updateCharacterStat(id: string, key: keyof Stats, value: number) {
    setDataset((prev) => ({
      ...prev,
      characters: prev.characters.map((c) =>
        c.id === id
          ? { ...c, baseStats: { ...c.baseStats, [key]: value } }
          : c,
      ),
    }))
  }

  function updateCharacterSlots(
    id: string,
    key: keyof CharacterSlots,
    value: number,
  ) {
    setDataset((prev) => ({
      ...prev,
      characters: prev.characters.map((c) =>
        c.id === id ? { ...c, slots: { ...c.slots, [key]: value } } : c,
      ),
    }))
  }

  return (
    <div className="space-y-4">
      {dataset.characters.map((character) => (
        <div
          key={character.id}
          className="rounded-card border border-border bg-surface p-4 text-on-surface"
        >
          <div className="flex flex-wrap items-center gap-4">
            <input
              value={character.name}
              onChange={(e) =>
                updateCharacter(character.id, { name: e.target.value })
              }
              className="w-32 rounded border border-border bg-void px-2 py-1 font-display text-small font-semibold text-on-void"
            />

            <label className="flex items-center gap-2 text-small">
              Level
              <input
                type="number"
                value={character.level ?? ""}
                onChange={(e) =>
                  updateCharacter(character.id, {
                    level:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="—"
                className="w-16 rounded border border-border bg-void px-1 py-0.5 font-mono text-on-void placeholder:text-text-muted"
              />
            </label>

            <label className="flex items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={character.armorRemovable}
                onChange={(e) =>
                  updateCharacter(character.id, {
                    armorRemovable: e.target.checked,
                  })
                }
              />
              Armor removable
            </label>

            <label className="flex items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={character.active}
                onChange={(e) =>
                  updateCharacter(character.id, { active: e.target.checked })
                }
              />
              Active (in party)
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-small">
            {STAT_KEYS.map((stat) => (
              <label key={stat} className="flex items-center gap-2">
                <span className={STAT_TEXT_CLASS[stat]}>
                  {stat.toUpperCase()}
                </span>
                <input
                  type="number"
                  value={character.baseStats[stat]}
                  onChange={(e) =>
                    updateCharacterStat(
                      character.id,
                      stat,
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  className="w-16 rounded border border-border bg-void px-1 py-0.5 font-mono text-on-void placeholder:text-text-muted"
                />
              </label>
            ))}

            <label className="flex items-center gap-2">
              Weapon slots
              <input
                type="number"
                min={0}
                value={character.slots.weapon}
                onChange={(e) =>
                  updateCharacterSlots(
                    character.id,
                    "weapon",
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
                className="w-16 rounded border border-border bg-void px-1 py-0.5 font-mono text-on-void placeholder:text-text-muted"
              />
            </label>

            <label className="flex items-center gap-2">
              Armor slots
              <input
                type="number"
                min={0}
                value={character.slots.armor}
                onChange={(e) =>
                  updateCharacterSlots(
                    character.id,
                    "armor",
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
                className="w-16 rounded border border-border bg-void px-1 py-0.5 font-mono text-on-void placeholder:text-text-muted"
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  )
}
