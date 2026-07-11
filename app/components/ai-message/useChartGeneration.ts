import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { ChartResult } from "./types";

type SetError = (message: string | null) => void;

interface UseChartGenerationParams {
  selectedData: Record<string, string>[];
  rowCount: number;
  colCount: number;
  prompt?: string;
  apiKey?: string;
  setError: SetError;
}

/**
 * Owns chart-type selection, chart count, and the batched chart-generation
 * request (with abort support) plus the "download all" zip export.
 */
export function useChartGeneration({
  selectedData,
  rowCount,
  colCount,
  prompt,
  apiKey,
  setError,
}: UseChartGenerationParams) {
  const [selectedChartTypes, setSelectedChartTypes] = useState<Set<string>>(new Set(["bar"]));
  const [chartSize, setChartSize] = useState<number>(5);
  const [chartResults, setChartResults] = useState<ChartResult[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [generatingCharts, setGeneratingCharts] = useState(false);
  const [currentChartIndex, setCurrentChartIndex] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight request on unmount.
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleChartTypeSelection = useCallback((type: string) => {
    setSelectedChartTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        if (newSet.size <= 1) {
          setError("You must select at least one chart type.");
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  }, [setError]);

  // Keep the number of selected chart types within the requested chart count.
  const handleChartSizeChange = useCallback((newSize: number) => {
    setChartSize(newSize);
    setSelectedChartTypes((prev) => {
      const types = Array.from(prev);
      if (types.length > newSize) {
        return new Set(types.slice(0, newSize));
      }
      return prev;
    });
  }, []);

  const generateChart = useCallback(async () => {
    if (rowCount === 0 || colCount === 0) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setChartLoading(true);
    setGeneratingCharts(true);
    setChartResults([]);
    setCurrentChartIndex(0);
    setError(null);

    try {
      const selectedTypes = Array.from(selectedChartTypes);

      if (selectedTypes.length === 0) {
        setError("Please select at least one chart type.");
        return;
      }

      if (!apiKey) {
        setError("Please provide your Cohere API key.");
        return;
      }

      const results: ChartResult[] = [];
      const CHUNK_SIZE = 2;
      const totalCharts = chartSize;

      for (let i = 0; i < totalCharts; i += CHUNK_SIZE) {
        if (abortControllerRef.current?.signal.aborted) break;

        const chunkPromises = [];
        const endIndex = Math.min(i + CHUNK_SIZE, totalCharts);

        for (let j = i; j < endIndex; j++) {
          setCurrentChartIndex(j);
          const chartType = selectedTypes[j % selectedTypes.length];

          const promise = fetch("/api/generate-chart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: selectedData,
              prompt: String(prompt),
              chartType: chartType,
              chartSize: chartSize,
              apiKey: apiKey
            }),
            signal: abortControllerRef.current?.signal
          })
          .then(async (response) => {
            if (!response.ok) throw new Error('Network response was not ok');
            const { code, image } = await response.json();
            const pythonCodeMatch = code.match(/```python\n([\s\S]*?)```/);
            const extractedCode = pythonCodeMatch ? pythonCodeMatch[1].trim() : code;

            return {
              type: chartType,
              code: extractedCode,
              image: String(image)
            };
          })
          .catch((error) => {
            if (error.name === 'AbortError') throw error;
            console.error(`Error generating chart ${j + 1}:`, error);
            return null;
          });

          chunkPromises.push(promise);
        }

        const chunkResults = await Promise.all(chunkPromises);
        const validResults = chunkResults.filter(Boolean) as ChartResult[];

        results.push(...validResults);
        setChartResults(prev => [...prev, ...validResults]);

        // Add a small delay between chunks to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
      }

    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError("Error generating charts. Please try again.");
      }
    } finally {
      setChartLoading(false);
      setGeneratingCharts(false);
      setCurrentChartIndex(0);
      abortControllerRef.current = null;
    }
  }, [selectedData, prompt, chartSize, selectedChartTypes, colCount, rowCount, apiKey, setError]);

  const handleDownloadAllCharts = useCallback(async () => {
    if (chartResults.length === 0) return;

    try {
      const zip = new JSZip();
      const codeFolder = zip.folder("python_code");
      const imagesFolder = zip.folder("chart_images");

      chartResults.forEach((result, index) => {
        if (codeFolder) {
          codeFolder.file(`${result.type}_chart_${index + 1}.py`, result.code);
        }
        if (imagesFolder) {
          const imageData = result.image.split(',')[1];
          if (imageData) {
            imagesFolder.file(`${result.type}_chart_${index + 1}.png`, imageData, { base64: true });
          }
        }
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated_charts.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading charts:', error);
      setError('Failed to download charts. Please try again.');
    }
  }, [chartResults, setError]);

  return {
    selectedChartTypes,
    handleChartTypeSelection,
    chartSize,
    handleChartSizeChange,
    chartResults,
    chartLoading,
    generatingCharts,
    currentChartIndex,
    generateChart,
    handleDownloadAllCharts,
  };
}
