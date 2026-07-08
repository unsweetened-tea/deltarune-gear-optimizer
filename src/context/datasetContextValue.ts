import { createContext, type Dispatch, type SetStateAction } from "react"
import type { Dataset } from "../types/data"

export interface DatasetContextValue {
  dataset: Dataset
  setDataset: Dispatch<SetStateAction<Dataset>>
}

export const DatasetContext = createContext<DatasetContextValue | null>(null)
