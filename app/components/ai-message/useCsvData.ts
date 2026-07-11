import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { FoodItem, MAX_SELECTIONS, MIN_SELECTIONS } from "./types";

type SetError = (message: string | null) => void;

/**
 * Parses an uploaded CSV file and owns the row/column selection state derived
 * from it (including the memoized `selectedData` slice passed to chart generation).
 */
export function useCsvData(
  fileType: "csv" | "image" | undefined,
  fileData: File | undefined,
  setError: SetError,
) {
  const [data, setData] = useState<FoodItem[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (fileType !== "csv" || !fileData) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      Papa.parse(e.target?.result as string, {
        header: true,
        complete: (results) => {
          const parsedData = results.data as FoodItem[];
          const filtered = parsedData.filter((row) =>
            Object.values(row).some((val) => val !== "")
          );
          setData(filtered);
          if (filtered.length > 0) {
            const cols = Object.keys(filtered[0]);
            setHeaders(cols);
            setSelectedColumns(new Set([cols[0]]));
            setSelectedRows(new Set([0]));
          }
          setLoading(false);
        },
        error: () => {
          setError("Failed to parse the CSV file. Please try again.");
          setLoading(false);
        },
      });
    };
    reader.readAsText(fileData);
  }, [fileType, fileData, setError]);

  const selectedData = useMemo<Record<string, string>[]>(() => {
    if (selectedRows.size === 0 || selectedColumns.size === 0) return [];

    const selectedColumnsArray = Array.from(selectedColumns);
    return Array.from(selectedRows).map((rowIndex) => {
      const row = data[rowIndex];
      return selectedColumnsArray.reduce((acc, column) => {
        acc[column] = row[column];
        return acc;
      }, {} as Record<string, string>);
    });
  }, [data, selectedRows, selectedColumns]);

  const handleRowSelection = useCallback((index: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        if (newSet.size <= MIN_SELECTIONS) {
          setError(`You must select at least ${MIN_SELECTIONS} row(s).`);
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        newSet.delete(index);
      } else {
        if (newSet.size >= MAX_SELECTIONS) {
          setError(`You cannot select more than ${MAX_SELECTIONS} rows.`);
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        newSet.add(index);
      }
      return newSet;
    });
  }, [setError]);

  const handleColumnSelection = useCallback((column: string) => {
    setSelectedColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(column)) {
        if (newSet.size <= MIN_SELECTIONS) {
          setError(`You must select at least ${MIN_SELECTIONS} column(s).`);
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        newSet.delete(column);
      } else {
        if (newSet.size >= MAX_SELECTIONS) {
          setError(`You cannot select more than ${MAX_SELECTIONS} columns.`);
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        newSet.add(column);
      }
      return newSet;
    });
  }, [setError]);

  return {
    data,
    headers,
    loading,
    selectedRows,
    selectedColumns,
    selectedData,
    handleRowSelection,
    handleColumnSelection,
  };
}
