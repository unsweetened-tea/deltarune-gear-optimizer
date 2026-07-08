import { useEffect, useState, type ReactNode } from "react"
import { loadDataset, saveDataset } from "../lib/storage"
import { DatasetContext } from "./datasetContextValue"
import type { Dataset } from "../types/data"

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset>(loadDataset)

  useEffect(() => {
    saveDataset(dataset)
  }, [dataset])

  return (
    <DatasetContext.Provider value={{ dataset, setDataset }}>
      {children}
    </DatasetContext.Provider>
  )
}
