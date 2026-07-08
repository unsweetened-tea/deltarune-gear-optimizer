import { useRef } from "react"
import { useDataset } from "./hooks/useDataset"
import { downloadDataset, readDatasetFile } from "./lib/exportImport"

function App() {
  const { dataset, setDataset } = useDataset()
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
    <div className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold text-purple-600">
        Deltarune Gear Optimizer
      </h1>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Characters</h2>
        <ul className="mt-2 space-y-1">
          {dataset.characters.map((character) => (
            <li key={character.id} className="text-sm">
              {character.name}
              {!character.active && (
                <span className="ml-2 text-gray-400">(inactive)</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Items</h2>
        <p className="mt-2 text-sm">{dataset.items.length} item(s) loaded</p>
      </section>

      <section className="mt-6 flex gap-3">
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
      </section>
    </div>
  )
}

export default App
