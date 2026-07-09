import { useRef, useState } from "react"
import { useDataset } from "./hooks/useDataset"
import { downloadDataset, readDatasetFile } from "./lib/exportImport"
import { ImportPanel } from "./components/ImportPanel"
import { ItemsPanel } from "./components/ItemsPanel"
import { CharactersPanel } from "./components/CharactersPanel"

type Tab = "import" | "items" | "characters"

const TABS: { id: Tab; label: string }[] = [
  { id: "import", label: "Import" },
  { id: "items", label: "Items" },
  { id: "characters", label: "Characters" },
]

function App() {
  const { dataset, setDataset } = useDataset()
  const [tab, setTab] = useState<Tab>("items")
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        <h1 className="text-2xl font-bold text-purple-600">
          Deltarune Gear Optimizer
        </h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => downloadDataset(dataset)}
            className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded border border-purple-600 px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50"
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

      <nav className="mt-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "px-4 py-2 text-sm font-medium " +
              (tab === t.id
                ? "border-b-2 border-purple-600 text-purple-600"
                : "text-gray-500 hover:text-gray-700")
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="mt-6">
        {tab === "import" && <ImportPanel />}
        {tab === "items" && <ItemsPanel />}
        {tab === "characters" && <CharactersPanel />}
      </main>
    </div>
  )
}

export default App
