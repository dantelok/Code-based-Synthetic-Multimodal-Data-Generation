"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Papa from "papaparse";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Loader2 } from 'lucide-react';
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
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';

interface FoodItem {
  [key: string]: string;
}

interface AiMessageProps {
  fileType?: 'csv' | 'image';
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
  const [chartCode, setChartCode] = useState<string>('');
  const [chartImage, setChartImage] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');

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

  // Memoize row selection handler
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

  // Memoize column selection handler
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

  // Memoize generate chart function
  const generateChart = useCallback(async () => {
    if (selectedRows.size === 0 || selectedColumns.size === 0) return;
    setChartLoading(true);
    try {
      const response = await fetch('/api/generate-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: selectedData,
          prompt: String(prompt)
        })
      });
      const { code, image } = await response.json();
      
      const pythonCodeMatch = code.match(/```python\n([\s\S]*?)```/);
      const extractedCode = pythonCodeMatch ? pythonCodeMatch[1].trim() : code;
      
      setChartCode(extractedCode);
      setChartImage(String(image));
    } catch (error) {
      setError('Error generating chart.');
    } finally {
      setChartLoading(false);
    }
  }, [selectedData, prompt]);

  // Virtualized table setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // Estimated row height
    overscan: 5,
    initialOffset: 0, // Ensure we start from the beginning
  });

  useEffect(() => {
    if (fileType === 'csv' && fileData) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        Papa.parse(e.target?.result as string, {
          header: true,
          complete: (results) => {
            const parsedData = results.data as FoodItem[];
            const filteredData = parsedData.filter((row) => Object.values(row).some((value) => value !== ""));
            setData(filteredData);
            if (filteredData.length > 0) {
              setHeaders(Object.keys(filteredData[0]));
              setSelectedColumns(new Set([Object.keys(filteredData[0])[0]]));
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
    } else if (fileType === 'image' && fileData) {
      const url = URL.createObjectURL(fileData);
      setImageUrl(url);
    }
  }, [fileType, fileData]);

  const renderTable = () => (
    <div ref={parentRef} className="h-[400px] overflow-auto scrollbar-hide">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <table className="w-full border-collapse">
          <thead className="bg-muted sticky top-0 z-10">
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
            {rowVirtualizer.getVirtualItems().map((virtualRow: VirtualItem) => {
              const row = data[virtualRow.index];
              return (
                <tr
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    zIndex: 1, // Ensure rows are properly stacked
                  }}
                  className={`${
                    selectedRows.has(virtualRow.index)
                      ? "bg-primary/5"
                      : virtualRow.index % 2 === 0
                      ? "bg-muted/50"
                      : ""
                  } hover:bg-muted/80`}
                >
                  <td className="p-2 border-b">
                    <Checkbox
                      checked={selectedRows.has(virtualRow.index)}
                      onCheckedChange={() => handleRowSelection(virtualRow.index)}
                      disabled={selectedRows.size >= MAX_SELECTIONS && !selectedRows.has(virtualRow.index)}
                    />
                  </td>
                  {headers.map((header) => (
                    <td
                      key={`${virtualRow.index}-${header}`}
                      className={`p-2 border-b ${selectedColumns.has(header) ? "bg-primary/10" : ""}`}
                    >
                      {row[header]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (fileType === 'csv') {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading data...</span>
        </div>
      );
    }
    if (data.length === 0) {
      return <div>No data available.</div>;
    }
    return (
      <div className="flex gap-2 p-4">
        <div>
          <Avatar className="w-14 h-14" >
            <AvatarImage src="/cohere.jpg" alt="AI Assistant"/>
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1">
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">Column Selection</h2>
                <div className="flex items-center mb-2">
                  <Badge variant="custom" className="mr-2">
                    {selectedColumns.size}/{MAX_SELECTIONS} columns selected
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {headers.map((header) => (
                    <div key={header} className="flex items-center space-x-2">
                      <Checkbox
                        id={`column-${header}`}
                        checked={selectedColumns.has(header)}
                        onCheckedChange={() => handleColumnSelection(header)}
                        disabled={selectedColumns.size >= MAX_SELECTIONS && !selectedColumns.has(header)}
                      />
                      <label
                        htmlFor={`column-${header}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {header}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Data Table</h2>
                <div className="flex items-center mb-2">
                  <Badge variant="custom" className="mr-2">
                    {selectedRows.size}/{MAX_SELECTIONS} rows selected
                  </Badge>
                  <Badge variant="custom">{data.length} total rows</Badge>
                </div>
                {renderTable()}
              </div>
              <div>
                <button
                  onClick={generateChart}
                  disabled={selectedRows.size === 0 || selectedColumns.size === 0 || chartLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 mt-4"
                >
                  {chartLoading ? 'Generating...' : 'Generate Chart'}
                </button>
              </div>
              {chartCode && (
                <div className="mt-4">
                  <Accordion type="single" collapsible className="w-full" defaultValue="code">
                    <AccordionItem value="code">
                      <AccordionTrigger className="text-lg font-semibold text-white">
                        Generated Chart
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="rounded-md overflow-hidden">
                            <CodeHighlight code={String(chartCode)} />
                            <PythonExecutor code={String(chartCode)} data={selectedData} />
                          </div>
                          
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For image files, just show the image (and future Aya Vision output)
  if (fileType === 'image' && imageUrl) {
    return (
      <div className="flex gap-2 p-4">
        <div>
          <Avatar>
            <AvatarImage src="/cohere.jpg" alt="AI Assistant" />
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1">
          <div className="space-y-4">
            <img src={imageUrl} alt="Uploaded image" className="max-w-full rounded-lg" />
            {/* TODO: Add Aya Vision analysis results here */}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default React.memo(AiMessage);