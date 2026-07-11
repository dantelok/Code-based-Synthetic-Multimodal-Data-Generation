import React from "react";
import { Download } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import CodeHighlight from "../CodeHighlight";
import PythonExecutor from "../PythonExecutor";
import { ChartResult } from "./types";

interface ChartResultsProps {
  chartResults: ChartResult[];
  currentChartIndex: number;
  generatingCharts: boolean;
  chartSize: number;
  selectedData: Record<string, string>[];
  onDownloadAll: () => void;
}

/** Grid of generated charts: collapsible code + in-browser Pyodide render. */
function ChartResults({
  chartResults,
  currentChartIndex,
  generatingCharts,
  chartSize,
  selectedData,
  onDownloadAll,
}: ChartResultsProps) {
  if (chartResults.length === 0) return null;

  return (
    <div className="mt-4 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h3 className="text-xl font-semibold text-white">Generated Charts</h3>
        <button
          onClick={onDownloadAll}
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
}

export default React.memo(ChartResults);
