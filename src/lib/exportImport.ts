import type { Dataset } from "../types/data"
import { parseDataset } from "./validateDataset"

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
        const dataset = parseDataset(JSON.parse(reader.result as string))
        if (dataset === null) {
          reject(new Error("File is not a valid dataset"))
          return
        }
        resolve(dataset)
      } catch {
        reject(new Error("Invalid JSON file"))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}
