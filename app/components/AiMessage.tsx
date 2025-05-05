"use client";

import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

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
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartCode, setChartCode] = useState<string>('');
  const [chartImage, setChartImage] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');

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
              setSelectedColumns([Object.keys(filteredData[0])[0]]);
              setSelectedRows([0]);
            }
            setLoading(false);
          },
          error: (error) => {
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

  const handleRowSelection = (index: number) => {
    setSelectedRows((prev) => {
      const isSelected = prev.includes(index);
      if (isSelected) {
        if (prev.length <= MIN_SELECTIONS) {
          setError(`You must select at least ${MIN_SELECTIONS} row(s).`);
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        return prev.filter((i) => i !== index);
      } else {
        if (prev.length >= MAX_SELECTIONS) {
          setError(`You cannot select more than ${MAX_SELECTIONS} rows.`);
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        return [...prev, index];
      }
    });
  };

  const handleColumnSelection = (column: string) => {
    setSelectedColumns((prev) => {
      const isSelected = prev.includes(column);
      if (isSelected) {
        if (prev.length <= MIN_SELECTIONS) {
          setError(`You must select at least ${MIN_SELECTIONS} column(s).`);
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        return prev.filter((c) => c !== column);
      } else {
        if (prev.length >= MAX_SELECTIONS) {
          setError(`You cannot select more than ${MAX_SELECTIONS} columns.`);
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        return [...prev, column];
      }
    });
  };

  const getSelectedData = () => {
    return selectedRows.map((rowIndex) => {
      const row: Record<string, string> = {};
      selectedColumns.forEach((column) => {
        row[column] = data[rowIndex][column];
      });
      return row;
    });
  };

  const generateChart = async () => {
    if (!selectedRows.length || !selectedColumns.length) return;
    setChartLoading(true);
    try {
      const response = await fetch('/api/generate-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: getSelectedData(),
          prompt: String(prompt)
        })
      });
      const { code, image } = await response.json();
      setChartCode(String(code));
      setChartImage(String(image));
    } catch (error) {
      setError('Error generating chart.');
    } finally {
      setChartLoading(false);
    }
  };

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
          <Avatar>
            <AvatarImage src="/ai-avatar.png" alt="AI Assistant" />
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
                  <Badge variant="outline" className="mr-2">
                    {selectedColumns.length}/{MAX_SELECTIONS} columns selected
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {headers.map((header) => (
                    <div key={header} className="flex items-center space-x-2">
                      <Checkbox
                        id={`column-${header}`}
                        checked={selectedColumns.includes(header)}
                        onCheckedChange={() => handleColumnSelection(header)}
                        disabled={selectedColumns.length >= MAX_SELECTIONS && !selectedColumns.includes(header)}
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
                  <Badge variant="outline" className="mr-2">
                    {selectedRows.length}/{MAX_SELECTIONS} rows selected
                  </Badge>
                  <Badge variant="outline">{data.length} total rows</Badge>
                </div>
                <ScrollArea className="h-[400px] border rounded-md">
                  <div className="w-full overflow-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left font-medium text-sm border-b">Select</th>
                          {headers.map((header) => (
                            <th
                              key={header}
                              className={`p-2 text-left font-medium text-sm border-b ${selectedColumns.includes(header) ? "bg-primary/10" : ""}`}
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row, index) => (
                          <tr
                            key={index}
                            className={`$${
                              selectedRows.includes(index)
                                ? "bg-primary/5"
                                : index % 2 === 0
                                ? "bg-muted/50"
                                : ""
                            } hover:bg-muted/80`}
                          >
                            <td className="p-2 border-b">
                              <Checkbox
                                checked={selectedRows.includes(index)}
                                onCheckedChange={() => handleRowSelection(index)}
                                disabled={selectedRows.length >= MAX_SELECTIONS && !selectedRows.includes(index)}
                              />
                            </td>
                            {headers.map((header) => (
                              <td
                                key={`${index}-${header}`}
                                className={`p-2 border-b ${selectedColumns.includes(header) ? "bg-primary/10" : ""}`}
                              >
                                {row[header]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Selected Data</h2>
                <Card>
                  <CardContent className="pt-6">
                    <ScrollArea className="h-[200px]">
                      <pre className="text-sm bg-muted/20 p-4 rounded-md">{JSON.stringify(getSelectedData(), null, 2)}</pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
              <div>
                <button
                  onClick={generateChart}
                  disabled={!selectedRows.length || !selectedColumns.length || chartLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 mt-4"
                >
                  {chartLoading ? 'Generating...' : 'Generate Chart'}
                </button>
              </div>
              {chartCode && (
                <div className="mt-4 bg-[#23232a] border border-[#333] rounded-lg p-4 shadow-md">
                  <h3 className="text-lg font-semibold mb-2 text-white">Generated Chart</h3>
                  <div className="mb-4">
                    <div className="text-xs text-gray-400 mb-1">Python Code</div>
                    <pre className="bg-[#18181c] text-green-300 p-3 rounded-md max-h-48 overflow-y-auto whitespace-pre-wrap text-sm">
                      <code>{String(chartCode)}</code>
                    </pre>
                  </div>
                  {chartImage && (
                    <div className="mt-2 flex flex-col items-center">
                      <div className="text-xs text-gray-400 mb-1">Chart Output</div>
                      <img src={String(chartImage)} alt="Generated chart" className="max-w-full rounded-md border border-[#444] bg-[#18181c]" />
                    </div>
                  )}
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
            <AvatarImage src="/ai-avatar.png" alt="AI Assistant" />
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

export default AiMessage;