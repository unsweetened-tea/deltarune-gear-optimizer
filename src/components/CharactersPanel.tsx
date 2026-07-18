import type { Character, CharacterSlots, Stats } from "../types/data"
import { useDataset } from "../hooks/useDataset"
import { STAT_INPUT_CLASS, STAT_TEXT_CLASS } from "../lib/statColors"
import { Card } from "./ui/Card"
import { Checkbox } from "./ui/Checkbox"
import { NumberInput, TextInput } from "./ui/inputs"

const STAT_KEYS = ["hp", "atk", "def", "magic"] as const

const fieldLabel = "flex flex-col gap-1 text-small text-text-muted"

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
        <Card key={character.id} className="space-y-4">
          {/* Identity + flags */}
          <div className="flex flex-wrap items-end gap-4">
            <label className={fieldLabel}>
              Name
              <TextInput
                value={character.name}
                onChange={(e) =>
                  updateCharacter(character.id, { name: e.target.value })
                }
                className="w-40 font-display font-semibold"
              />
            </label>
            <label className={fieldLabel}>
              Level
              <NumberInput
                value={character.level ?? ""}
                onChange={(e) =>
                  updateCharacter(character.id, {
                    level:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="—"
                className="w-20 text-right"
              />
            </label>
            <div className="flex flex-col gap-1.5 pb-1">
              <Checkbox
                label="Armor removable"
                checked={character.armorRemovable}
                onChange={(e) =>
                  updateCharacter(character.id, {
                    armorRemovable: e.target.checked,
                  })
                }
              />
              <Checkbox
                label="Active (in party)"
                checked={character.active}
                onChange={(e) =>
                  updateCharacter(character.id, { active: e.target.checked })
                }
              />
            </div>
          </div>

          {/* Base stats */}
          <div>
            <div className="mb-1.5 text-small font-medium text-text-muted">
              Base stats
            </div>
            <div className="flex flex-wrap gap-3">
              {STAT_KEYS.map((stat) => (
                <label key={stat} className="flex flex-col gap-1">
                  <span
                    className={`text-small font-medium uppercase ${STAT_TEXT_CLASS[stat]}`}
                  >
                    {stat}
                  </span>
                  <NumberInput
                    value={character.baseStats[stat]}
                    onChange={(e) =>
                      updateCharacterStat(
                        character.id,
                        stat,
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                    className={`w-20 text-right ${STAT_INPUT_CLASS[stat]}`}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Slots */}
          <div>
            <div className="mb-1.5 text-small font-medium text-text-muted">
              Equip slots
            </div>
            <div className="flex flex-wrap gap-3">
              <label className={fieldLabel}>
                Weapon
                <NumberInput
                  min={0}
                  value={character.slots.weapon}
                  onChange={(e) =>
                    updateCharacterSlots(
                      character.id,
                      "weapon",
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  className="w-20 text-right"
                />
              </label>
              <label className={fieldLabel}>
                Armor
                <NumberInput
                  min={0}
                  value={character.slots.armor}
                  onChange={(e) =>
                    updateCharacterSlots(
                      character.id,
                      "armor",
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  className="w-20 text-right"
                />
              </label>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
