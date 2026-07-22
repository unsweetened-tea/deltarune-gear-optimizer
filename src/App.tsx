import { useRef, useState } from "react"
import { useDataset } from "./hooks/useDataset"
import { useRoute } from "./hooks/useRoute"
import { downloadDataset, readDatasetFile } from "./lib/exportImport"
import type { Tab } from "./lib/routes"
import { routeHref } from "./lib/routes"
import {
  appliedSeedVersion,
  bundledSeedVersion,
  dismissSeedNote,
  isSeedNoteDismissed,
  loadSeedDataset,
  markSeedApplied,
} from "./lib/storage"
import { AboutScreen } from "./components/AboutScreen"
import { HomeScreen } from "./components/HomeScreen"
import { ImportPanel } from "./components/ImportPanel"
import { ItemsPanel } from "./components/ItemsPanel"
import { CharactersPanel } from "./components/CharactersPanel"
import { OptimizerPanel } from "./components/OptimizerPanel"
import { OptimizeScreen } from "./components/OptimizeScreen"
import { StylePanel } from "./components/StylePanel"
import { PrimaryNav } from "./components/PrimaryNav"
import { Button } from "./components/ui/Button"

const TABS: {
  id: Tab
  label: string
  devOnly?: boolean
  /** Routable and titled, but kept out of the primary nav. */
  unlisted?: boolean
}[] = [
  { id: "home", label: "Home" },
  { id: "optimize", label: "Optimize" },
  { id: "solo", label: "Solo Max" },
  { id: "import", label: "Import" },
  { id: "items", label: "Items" },
  { id: "characters", label: "Characters" },
  { id: "style", label: "Style", devOnly: true },
  { id: "about", label: "About", unlisted: true },
]

function App() {
  const { dataset, setDataset } = useDataset()
  const { route, navigate } = useRoute()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showSeedNote, setShowSeedNote] = useState(() => {
    const applied = appliedSeedVersion()
    return (
      applied !== null &&
      bundledSeedVersion > applied &&
      !isSeedNoteDismissed()
    )
  })

  const visibleTabs = TABS.filter(
    (t) => !t.unlisted && (!t.devOnly || import.meta.env.DEV),
  )
  // The dev-only Style screen must not be reachable by hash in a prod build.
  const tab: Tab =
    route.tab === "style" && !import.meta.env.DEV ? "home" : route.tab
  const currentLabel = TABS.find((t) => t.id === tab)?.label ?? "Home"

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
          <a
            href={routeHref("home")}
            className="rounded font-display text-h2 text-on-void hover:text-soul sm:text-h1"
          >
            Deltarune Gear Optimizer (Beta)
          </a>
          <PrimaryNav
            sections={visibleTabs}
            activeId={tab}
            onSelect={(id) => navigate(id as Tab)}
          />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Home stays identical for every visitor — no saved-state notes. */}
        {showSeedNote && tab !== "home" && (
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

        {/* Home carries its own hero, and skips the dataset toolbar so the
            launch buttons stay above the fold. */}
        {tab !== "home" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-display text-h1 text-on-void">
              {currentLabel}
            </h1>
            {tab !== "about" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={() => downloadDataset(dataset)}
                >
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
              </div>
            )}
          </div>
        )}

        <main className={tab === "home" ? "" : "mt-6"}>
          {tab === "home" && (
            <HomeScreen
              onNavigate={navigate}
              storeIsEmpty={dataset.items.length === 0}
              onReset={handleReset}
              onImport={handleImportClick}
            />
          )}
          {tab === "about" && <AboutScreen onNavigate={navigate} />}
          {tab === "optimize" && (
            <OptimizeScreen initialCategory={route.optimizeCategory} />
          )}
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
