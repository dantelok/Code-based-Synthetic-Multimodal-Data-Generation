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
import { useVirtualizer } from "@tanstack/react-virtual";
import { RiAiGenerate2 } from "react-icons/ri";

interface FoodItem {
  [key: string]: string;
}

interface AiMessageProps {
  fileType?: "csv" | "image";
  fileData?: File;
  prompt?: string;
}

const MAX_SELECTIONS = 10;
const MIN_SELECTIONS = 1;

const AiMessage: React.FC<AiMessageProps> = ({ fileType, fileData, prompt }) => {
  const [data, setData] = useState<FoodItem[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartCode, setChartCode] = useState<string>("");
  const [chartImage, setChartImage] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageAnalysis, setImageAnalysis] = useState<string>("");
  const [imageAnalysisLoading, setImageAnalysisLoading] = useState(false);

  // Memoize selected data
  const selectedData = useMemo(() => {
    return Array.from(selectedRows).map((rowIndex) => {
      const row: Record<string, string> = {};
      Array.from(selectedColumns).forEach((column) => {
        row[column] = data[rowIndex][column];
      });
      return row;
    });
  }, [data, selectedRows, selectedColumns]);

  // Row selection handler
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

  // Column selection handler
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

  // Generate chart
  const generateChart = useCallback(async () => {
    if (selectedRows.size === 0 || selectedColumns.size === 0) return;
    setChartLoading(true);
    try {
      const response = await fetch("/api/generate-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: selectedData,
          prompt: String(prompt),
        }),
      });
      const { code, image } = await response.json();
      const pythonCodeMatch = code.match(/```python\n([\s\S]*?)```/);
      const extractedCode = pythonCodeMatch ? pythonCodeMatch[1].trim() : code;
      setChartCode(extractedCode);
      setChartImage(String(image));
    } catch (e) {
      setError("Error generating chart.");
    } finally {
      setChartLoading(false);
    }
  }, [selectedData, prompt]);

  // Virtualizer
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

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
  }, [fileType, fileData, prompt]);

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
    } catch (e) {
      setError('Failed to download Q&A pairs');
    }
  }, [imageAnalysis]);

  // Render non-virtualized table
  const renderTable = () => (
    <div className="h-[400px] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-400/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400/50">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: '60px' }} />
          {headers.map((_, idx) => (
            <col key={idx} style={{ width: `${100 / headers.length}%` }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-[oklch(0.33_0.12_294.06)]">
          <tr>
            <th className="p-2 text-left font-medium text-sm border-b">Select</th>
            {headers.map((header) => (
              <th
                key={header}
                className={`p-2 text-left font-medium text-sm border-b ${selectedColumns.has(header) ? "bg-primary/10" : ""}`}
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
              className={`$${
                selectedRows.has(rowIndex)
                  ? "bg-primary/5"
                  : rowIndex % 2 === 0
                  ? "bg-[oklch(0.33_0.12_294.06)]/50"
                  : ""
              } hover:bg-[oklch(0.33_0.12_294.06)]/80`}
            >
              <td className="p-2 border-b">
                <Checkbox
                  checked={selectedRows.has(rowIndex)}
                  onCheckedChange={() => handleRowSelection(rowIndex)}
                  disabled={selectedRows.size >= MAX_SELECTIONS && !selectedRows.has(rowIndex)}
                />
              </td>
              {headers.map((header) => (
                <td
                  key={`${rowIndex}-${header}`}
                  className={`p-2 border-b ${selectedColumns.has(header) ? "bg-primary/10" : ""}`}
                >
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // CSV view
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
      <div className="flex gap-2 p-4">
        <Avatar className="w-14 h-14">
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
                <Badge variant="custom" className="mr-2">
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
              <div className="flex items-center mb-2 space-x-2">
                <Badge variant="custom">
                  {selectedRows.size}/{MAX_SELECTIONS} rows selected
                </Badge>
                <Badge variant="custom">{data.length} total rows</Badge>
              </div>
              {renderTable()}
            </div>
            <button
              onClick={generateChart}
              disabled={
                !selectedRows.size ||
                !selectedColumns.size ||
                chartLoading
              }
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {chartLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RiAiGenerate2 className="h-5 w-5" />
                  Generate Chart
                </>
              )}
            </button>
            {chartCode && (
              <><div className="mt-4 space-y-4">
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  defaultValue="code"
                >
                  <AccordionItem value="code">
                    <AccordionTrigger className="text-lg font-semibold text-white">
                      Generated Chart
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="rounded-md border-gray-400 overflow-hidden">
                        <CodeHighlight code={chartCode} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div><div className="pt-4">
                  <PythonExecutor
                    code={chartCode}
                    data={selectedData} />
                </div></>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Image view
  if (fileType === "image" && imageUrl) {
    return (
      <div className="flex gap-2 p-4">
        <Avatar className="w-14 h-14">
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
                className="max-w-full rounded-lg mb-4"
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
                      // Handle Q&A pairs from JSON
                      (() => {
                        try {
                          const qaData = JSON.parse(imageAnalysis);
                          return (
                            <>
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold text-white">Image Q&A</h3>
                                <button
                                  onClick={handleDownloadQA}
                                  className="flex items-center gap-2 px-4 py-2 bg-[#8777e0] text-white rounded-md hover:bg-[#8476d4]/80 transition-colors"
                                >
                                  <Download className="h-4 w-4" />
                                  Download Q&A
                                </button>
                              </div>
                              <div className="space-y-4">
                                {qaData.qa_pairs.map((qa: { question: string; answer: string }, index: number) => (
                                  <div key={index} className="bg-[#232325] p-4 rounded-lg">
                                    <p className="font-medium text-[#8476d4] mb-2">Q: {qa.question}</p>
                                    <p className="text-gray-300">A: {qa.answer}</p>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        } catch (e) {
                          // Fallback to regular text display if JSON parsing fails
                          return <div className="whitespace-pre-wrap">{imageAnalysis}</div>;
                        }
                      })()
                    ) : (
                      // Regular text analysis
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