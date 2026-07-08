import type { Dataset } from "../types/data"

export function downloadDataset(dataset: Dataset): void {
  const blob = new Blob([JSON.stringify(dataset, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = "deltarune-optimizer-dataset.json"
  link.click()

  URL.revokeObjectURL(url)
}

export function readDatasetFile(file: File): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string) as Dataset)
      } catch {
        reject(new Error("Invalid JSON file"))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}
