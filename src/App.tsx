import { useRef, useState } from "react"
import { useDataset } from "./hooks/useDataset"
import { downloadDataset, readDatasetFile } from "./lib/exportImport"
import {
  appliedSeedVersion,
  bundledSeedVersion,
  dismissSeedNote,
  isSeedNoteDismissed,
  loadSeedDataset,
  markSeedApplied,
} from "./lib/storage"
import { ImportPanel } from "./components/ImportPanel"
import { ItemsPanel } from "./components/ItemsPanel"
import { CharactersPanel } from "./components/CharactersPanel"
import { OptimizerPanel } from "./components/OptimizerPanel"
import { OptimizeScreen } from "./components/OptimizeScreen"
import { StylePanel } from "./components/StylePanel"
import { PrimaryNav } from "./components/PrimaryNav"
import { Button } from "./components/ui/Button"

type Tab = "optimize" | "solo" | "import" | "items" | "characters" | "style"

const TABS: { id: Tab; label: string; devOnly?: boolean }[] = [
  { id: "optimize", label: "Optimize" },
  { id: "solo", label: "Solo Max" },
  { id: "import", label: "Import" },
  { id: "items", label: "Items" },
  { id: "characters", label: "Characters" },
  { id: "style", label: "Style", devOnly: true },
]

function App() {
  const { dataset, setDataset } = useDataset()
  const [tab, setTab] = useState<Tab>("optimize")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showSeedNote, setShowSeedNote] = useState(() => {
    const applied = appliedSeedVersion()
    return (
      applied !== null &&
      bundledSeedVersion > applied &&
      !isSeedNoteDismissed()
    )
  })

  const visibleTabs = TABS.filter((t) => !t.devOnly || import.meta.env.DEV)
  const currentLabel =
    visibleTabs.find((t) => t.id === tab)?.label ?? "Optimize"

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleReset = () => {
    const seed = loadSeedDataset()
    if (!seed) {
      alert("The bundled default data failed to load — reset unavailable.")
      return
    }
    const confirmed = confirm(
      "Reset to default data?\n\nThis replaces your ENTIRE dataset with the bundled defaults. Your owned counts, item edits, exclusions, bosses, and custom presets will be LOST.\n\nExport a JSON backup first if you want to keep them.",
    )
    if (!confirmed) return
    setDataset(seed)
    markSeedApplied(bundledSeedVersion)
    setShowSeedNote(false)
  }

  const handleDismissSeedNote = () => {
    dismissSeedNote()
    setShowSeedNote(false)
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    try {
      const imported = await readDatasetFile(file)
      setDataset(imported)
    } catch {
      alert("Failed to import dataset: invalid JSON file")
    }
  }

  return (
    <div className="min-h-screen bg-void text-on-void">
      <header className="sticky top-0 z-30 border-b border-border bg-void">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <span className="font-display text-h2 text-on-void sm:text-h1">
            Deltarune Gear Optimizer (Beta)
          </span>
          <PrimaryNav
            sections={visibleTabs}
            activeId={tab}
            onSelect={(id) => setTab(id as Tab)}
          />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        {showSeedNote && (
          <p className="mb-6 flex items-center gap-3 rounded-card border border-border bg-surface-2 p-3 text-small text-on-surface-2">
            <span>
              A newer default dataset (v{bundledSeedVersion}) is bundled with
              this build. Your saved data was kept as-is — use{" "}
              <span className="font-medium">Reset to default data</span> to
              load it (your edits would be lost).
            </span>
            <Button
              variant="neutral"
              size="sm"
              onClick={handleDismissSeedNote}
              className="ml-auto shrink-0"
            >
              Dismiss
            </Button>
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-h1 text-on-void">{currentLabel}</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => downloadDataset(dataset)}>
              Export JSON
            </Button>
            <Button variant="secondary" onClick={handleImportClick}>
              Import JSON
            </Button>
            <Button
              variant="warning"
              onClick={handleReset}
              title="Replace your entire dataset with the bundled defaults (asks for confirmation)"
            >
              Reset to default data
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        <main className="mt-6">
          {tab === "optimize" && <OptimizeScreen />}
          {tab === "solo" && <OptimizerPanel />}
          {tab === "import" && <ImportPanel />}
          {tab === "items" && <ItemsPanel />}
          {tab === "characters" && <CharactersPanel />}
          {tab === "style" && <StylePanel />}
        </main>
      </div>
    </div>
  )
}

export default App
