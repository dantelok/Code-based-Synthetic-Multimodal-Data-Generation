"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Papa from "papaparse";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Loader2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import CodeHighlight from "./CodeHighlight";
import PythonExecutor from "./PythonExecutor";
import { RiAiGenerate2 } from "react-icons/ri";
import JSZip from 'jszip';

interface FoodItem {
  [key: string]: string;
}

interface AiMessageProps {
  fileType?: "csv" | "image";
  fileData?: File;
  prompt?: string;
  apiKey?: string;
}

const MAX_SELECTIONS = 10;
const MIN_SELECTIONS = 1;

const AiMessage: React.FC<AiMessageProps> = ({ fileType, fileData, prompt, apiKey }) => {
  const [data, setData] = useState<FoodItem[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartResults, setChartResults] = useState<Array<{type: string, code: string, image: string}>>([]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageAnalysis, setImageAnalysis] = useState<string>("");
  const [imageAnalysisLoading, setImageAnalysisLoading] = useState(false);
  const [selectedChartTypes, setSelectedChartTypes] = useState<Set<string>>(new Set(["bar"]));
  const [chartSize, setChartSize] = useState<number>(5);
  const [currentChartIndex, setCurrentChartIndex] = useState<number>(0);
  const [generatingCharts, setGeneratingCharts] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoize selected data with better performance
  const selectedData = useMemo(() => {
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

  // Cleanup function for aborting requests
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Optimize row selection handler
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
  }, []);

  // Optimize column selection handler
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
  }, []);

  // Chart type selection handler
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
  }, []);

  // Optimize chart generation with better error handling and state management
  const generateChart = useCallback(async () => {
    if (selectedRows.size === 0 || selectedColumns.size === 0) return;
    
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

      const results: Array<{type: string, code: string, image: string}> = [];
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
        const validResults = chunkResults.filter(Boolean) as Array<{type: string, code: string, image: string}>;
        
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
  }, [selectedData, prompt, chartSize, selectedChartTypes, selectedColumns.size, selectedRows.size, apiKey]);

  // Add download all charts functionality
  const handleDownloadAllCharts = useCallback(async () => {
    if (chartResults.length === 0) return;

    try {
      const zip = new JSZip();
      const codeFolder = zip.folder("python_code");
      const imagesFolder = zip.folder("chart_images");

      // Add each chart's code and image to the zip
      chartResults.forEach((result, index) => {
        if (codeFolder) {
          codeFolder.file(`${result.type}_chart_${index + 1}.py`, result.code);
        }
        if (imagesFolder) {
          // Convert base64 image to blob
          const imageData = result.image.split(',')[1];
          if (imageData) {
            imagesFolder.file(`${result.type}_chart_${index + 1}.png`, imageData, { base64: true });
          }
        }
      });

      // Generate and download the zip file
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
  }, [chartResults]);

  // Memoize chart results display
  const ChartResultsDisplay = useMemo(() => {
    if (chartResults.length === 0) return null;

    return (
      <div className="mt-4 space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h3 className="text-xl font-semibold text-white">Generated Charts</h3>
          <button
            onClick={handleDownloadAllCharts}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[#8777e0] text-white rounded-md hover:bg-[#8476d4]/80 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download All Charts
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chartResults.map((result, index) => (
            <div key={`${result.type}-${index}`} className="space-y-4 bg-[#232325] rounded-lg p-4">
              <Accordion
                type="single"
                collapsible
                className="w-full"
              >
                <AccordionItem value="code">
                  <AccordionTrigger className="text-lg font-semibold text-purple-100 hover:text-purple-200 transition-colors">
                    {result.type.charAt(0).toUpperCase() + result.type.slice(1)} Chart
                    {index === currentChartIndex && generatingCharts && (
                      <span className="ml-2 text-sm text-purple-300">(Generating...)</span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="rounded-md border-purple-200/20 overflow-hidden">
                      <CodeHighlight code={result.code} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <div className="pt-4">
                <PythonExecutor
                  code={result.code}
                  data={selectedData}
                />
              </div>
            </div>
          ))}
        </div>
        {generatingCharts && currentChartIndex < chartSize - 1 && (
          <div className="text-center py-4">
            <div className="text-purple-200">Generating next chart...</div>
            <div className="text-sm text-purple-300 mt-2">
              {currentChartIndex + 1} of {chartSize} charts completed
            </div>
          </div>
        )}
      </div>
    );
  }, [chartResults, currentChartIndex, generatingCharts, chartSize, selectedData, handleDownloadAllCharts]);

  // Load CSV / Image logic
  useEffect(() => {
    if (fileType === "csv" && fileData) {
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
    } else if (fileType === "image" && fileData) {
      const url = URL.createObjectURL(fileData);
      setImageUrl(url);
      const analyze = async () => {
        setImageAnalysisLoading(true);
        try {
          const r = new FileReader();
          r.readAsDataURL(fileData);
          r.onloadend = async () => {
            const base64 = (r.result as string).split(",")[1];
            const resp = await fetch("/api/aya-understanding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: prompt || "Describe this image in detail",
                imageBase64: base64,
                apiKey: apiKey
              }),
            });
            if (!resp.ok) throw new Error();
            const json = await resp.json();
            setImageAnalysis(json.response);
          };
        } catch {
          setError("Failed to analyze the image. Please try again.");
        } finally {
          setImageAnalysisLoading(false);
        }
      };
      analyze();
    }
  }, [fileType, fileData, prompt, apiKey]);

  const handleDownloadQA = useCallback(() => {
    if (!imageAnalysis) return;
    
    try {
      const qaData = JSON.parse(imageAnalysis);
      const content = qaData.qa_pairs
        .map((qa: { question: string; answer: string }) => 
          `Q: ${qa.question}\nA: ${qa.answer}\n\n`
        )
        .join('');
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'image-qa.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download Q&A pairs');
    }
  }, [imageAnalysis]);

  // Optimize table rendering with responsive design
  const renderTable = useCallback(() => (
    <div className="h-[400px] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-400/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-400/50">
      <div className="min-w-[600px]"> {/* Minimum width to prevent table from becoming too cramped */}
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col style={{ width: '60px' }} />
            {headers.map((_, idx) => (
              <col key={idx} style={{ width: `${100 / headers.length}%` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-[#6B46C1]">
            <tr>
              <th className="p-2 text-left font-medium text-sm border-b border-purple-200/20 text-white">Select</th>
              {headers.map((header) => (
                <th
                  key={header}
                  className={`p-2 text-left font-medium text-sm border-b border-purple-200/20 text-white ${selectedColumns.has(header) ? "bg-[#6B46C1]" : ""}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`${
                  selectedRows.has(rowIndex)
                    ? "bg-[#6B46C1]/5"
                    : rowIndex % 2 === 0
                    ? "bg-[#6B46C1]/5"
                    : ""
                } hover:bg-[#6B46C1]/10 transition-colors`}
              >
                <td className="p-2 border-b border-purple-200/20">
                  <Checkbox
                    checked={selectedRows.has(rowIndex)}
                    onCheckedChange={() => handleRowSelection(rowIndex)}
                    disabled={selectedRows.size >= MAX_SELECTIONS && !selectedRows.has(rowIndex)}
                    className="border-purple-300 data-[state=checked]:bg-[#6B46C1] data-[state=checked]:border-[#6B46C1]"
                  />
                </td>
                {headers.map((header) => (
                  <td
                    key={`${rowIndex}-${header}`}
                    className={`p-2 border-b border-purple-200/20 ${selectedColumns.has(header) ? "bg-[#6B46C1]/10" : ""}`}
                  >
                    {row[header]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ), [data, headers, selectedRows, selectedColumns, handleRowSelection]);

  // Update the chart size handler to adjust selected types if needed
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

  // CSV view with responsive design
  if (fileType === "csv") {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <span className="ml-2">Loading data...</span>
        </div>
      );
    }
    if (!data.length) {
      return <div>No data available.</div>;
    }
    return (
      <div className="flex flex-col lg:flex-row gap-4 p-4">
        <Avatar className="w-14 h-14 shrink-0">
          <AvatarImage
            src="/cohere.jpg"
            alt="AI Assistant"
            className="w-full h-full"
            width={56}
            height={56}
          />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-2">
                Column Selection
              </h2>
              <div className="flex items-center mb-2">
                <Badge variant="custom" className="mr-2 bg-[#6B46C1]/20 text-purple-200">
                  {selectedColumns.size}/{MAX_SELECTIONS} columns selected
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {headers.map((hdr) => (
                  <div key={hdr} className="flex items-center space-x-2">
                    <Checkbox
                      id={`col-${hdr}`}
                      checked={selectedColumns.has(hdr)}
                      onCheckedChange={() => handleColumnSelection(hdr)}
                      disabled={
                        selectedColumns.size >= MAX_SELECTIONS &&
                        !selectedColumns.has(hdr)
                      }
                    />
                    <label
                      htmlFor={`col-${hdr}`}
                      className="text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {hdr}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Data Table</h2>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="custom">
                  {selectedRows.size}/{MAX_SELECTIONS} rows selected
                </Badge>
                <Badge variant="custom">{data.length} total rows</Badge>
              </div>
              {renderTable()}
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Chart Settings</h2>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Available Chart Types</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { value: "bar", label: "Bar Chart" },
                      { value: "line", label: "Line Chart" },
                      { value: "scatter", label: "Scatter Plot" },
                      { value: "pie", label: "Pie Chart" },
                      { value: "area", label: "Area Chart" },
                      { value: "histogram", label: "Histogram" }
                    ].map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`chart-${type.value}`}
                          checked={selectedChartTypes.has(type.value)}
                          onCheckedChange={() => handleChartTypeSelection(type.value)}
                          className="border-purple-300 data-[state=checked]:bg-[#6B46C1] data-[state=checked]:border-[#6B46C1]"
                        />
                        <label
                          htmlFor={`chart-${type.value}`}
                          className="text-sm font-medium text-purple-100 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {type.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Chart Size (0-10)</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={chartSize}
                    onChange={(e) => handleChartSizeChange(Number(e.target.value))}
                    className="w-full accent-[#6B46C1]"
                  />
                  <div className="text-sm text-purple-200 mt-1">
                    Size: {chartSize} (Will generate up to {chartSize} charts)
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={generateChart}
              disabled={
                !selectedRows.size ||
                !selectedColumns.size ||
                chartLoading
              }
              className="w-full sm:w-auto px-4 py-2 bg-[#6B46C1] text-white rounded-md hover:bg-[#553C9A] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {chartLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {generatingCharts ? `Generating Chart ${currentChartIndex + 1} of ${chartSize}...` : 'Generating...'}
                </>
              ) : (
                <>
                  <RiAiGenerate2 className="h-5 w-5" />
                  Generate Charts
                </>
              )}
            </button>
            {ChartResultsDisplay}
          </div>
        </div>
      </div>
    );
  }

  // Image view with responsive design
  if (fileType === "image" && imageUrl) {
    return (
      <div className="flex flex-col lg:flex-row gap-4 p-4">
        <Avatar className="w-14 h-14 shrink-0">
          <AvatarImage
            src="/cohere.jpg"
            alt="AI Assistant"
            className="w-full h-full"
            width={56}
            height={56}
          />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Card className="overflow-hidden bg-transparent border-none">
            <CardContent className="p-4">
              <img
                src={imageUrl}
                alt="Uploaded"
                className="max-w-full h-auto rounded-lg mb-4"
              />
              {imageAnalysisLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-white mr-2" />
                  <span>Analyzing image...</span>
                </div>
              ) : imageAnalysis ? (
                <div className="prose prose-invert max-w-none pt-3">
                  <div className="space-y-4">
                    {!prompt ? (
                      (() => {
                        try {
                          const qaData = JSON.parse(imageAnalysis);
                          return (
                            <>
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                <h3 className="text-xl font-semibold text-white">Image Q&A</h3>
                                <button
                                  onClick={handleDownloadQA}
                                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[#8777e0] text-white rounded-md hover:bg-[#8476d4]/80 transition-colors"
                                >
                                  <Download className="h-4 w-4" />
                                  Download Q&A
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {qaData.qa_pairs.map((qa: { question: string; answer: string }, index: number) => (
                                  <div key={index} className="bg-[#232325] p-4 rounded-lg">
                                    <p className="font-medium text-[#8476d4] mb-2">Q: {qa.question}</p>
                                    <p className="text-gray-300">A: {qa.answer}</p>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        } catch  {
                          return <div className="whitespace-pre-wrap">{imageAnalysis}</div>;
                        }
                      })()
                    ) : (
                      <div className="whitespace-pre-wrap">{imageAnalysis}</div>
                    )}
                  </div>
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
};

export default React.memo(AiMessage);