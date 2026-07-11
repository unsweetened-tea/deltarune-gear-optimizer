import { useRef, useState } from "react"
import { useDataset } from "./hooks/useDataset"
import { downloadDataset, readDatasetFile } from "./lib/exportImport"
import { ImportPanel } from "./components/ImportPanel"
import { ItemsPanel } from "./components/ItemsPanel"
import { CharactersPanel } from "./components/CharactersPanel"
import { OptimizerPanel } from "./components/OptimizerPanel"
import { OptimizeScreen } from "./components/OptimizeScreen"
import { StylePanel } from "./components/StylePanel"

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

  const visibleTabs = TABS.filter((t) => !t.devOnly || import.meta.env.DEV)

  const handleImportClick = () => {
    fileInputRef.current?.click()
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
    <div className="mx-auto max-w-6xl p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-display text-on-void">
          Deltarune Gear Optimizer
        </h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => downloadDataset(dataset)}
            className="rounded bg-soul px-4 py-2 text-small font-medium text-on-soul hover:bg-soul/90"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded border border-soul px-4 py-2 text-small font-medium text-soul hover:bg-soul/10"
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </header>

      <nav className="mt-6 flex gap-1 border-b border-border">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "px-4 py-2 text-small font-medium " +
              (tab === t.id
                ? "border-b-2 border-soul text-soul"
                : "text-text-muted hover:text-on-void")
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="mt-6">
        {tab === "optimize" && <OptimizeScreen />}
        {tab === "solo" && <OptimizerPanel />}
        {tab === "import" && <ImportPanel />}
        {tab === "items" && <ItemsPanel />}
        {tab === "characters" && <CharactersPanel />}
        {tab === "style" && <StylePanel />}
      </main>
    </div>
  )
}

export default App
