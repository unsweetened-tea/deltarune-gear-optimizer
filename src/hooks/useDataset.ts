import { useContext } from "react"
import {
  DatasetContext,
  type DatasetContextValue,
} from "../context/datasetContextValue"

export function useDataset(): DatasetContextValue {
  const context = useContext(DatasetContext)
  if (!context) {
    throw new Error("useDataset must be used within a DatasetProvider")
  }
  return context
}
