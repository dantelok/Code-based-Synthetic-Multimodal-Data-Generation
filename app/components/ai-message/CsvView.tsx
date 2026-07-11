import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RiAiGenerate2 } from "react-icons/ri";
import AiAvatar from "./AiAvatar";
import DataTable from "./DataTable";
import ChartResults from "./ChartResults";
import { CHART_TYPES, MAX_SELECTIONS } from "./types";
import type { useCsvData } from "./useCsvData";
import type { useChartGeneration } from "./useChartGeneration";

interface CsvViewProps {
  error: string | null;
  csv: ReturnType<typeof useCsvData>;
  chart: ReturnType<typeof useChartGeneration>;
}

/** The CSV branch: column/row selection, chart settings, and generated charts. */
export default function CsvView({ error, csv, chart }: CsvViewProps) {
  if (csv.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <span className="ml-2">Loading data...</span>
      </div>
    );
  }
  if (!csv.data.length) {
    return <div>No data available.</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      <AiAvatar />
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
                {csv.selectedColumns.size}/{MAX_SELECTIONS} columns selected
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {csv.headers.map((hdr) => (
                <div key={hdr} className="flex items-center space-x-2">
                  <Checkbox
                    id={`col-${hdr}`}
                    checked={csv.selectedColumns.has(hdr)}
                    onCheckedChange={() => csv.handleColumnSelection(hdr)}
                    disabled={
                      csv.selectedColumns.size >= MAX_SELECTIONS &&
                      !csv.selectedColumns.has(hdr)
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
                {csv.selectedRows.size}/{MAX_SELECTIONS} rows selected
              </Badge>
              <Badge variant="custom">{csv.data.length} total rows</Badge>
            </div>
            <DataTable
              data={csv.data}
              headers={csv.headers}
              selectedRows={csv.selectedRows}
              selectedColumns={csv.selectedColumns}
              onRowSelect={csv.handleRowSelection}
            />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Chart Settings</h2>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Available Chart Types</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {CHART_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`chart-${type.value}`}
                        checked={chart.selectedChartTypes.has(type.value)}
                        onCheckedChange={() => chart.handleChartTypeSelection(type.value)}
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
                  value={chart.chartSize}
                  onChange={(e) => chart.handleChartSizeChange(Number(e.target.value))}
                  className="w-full accent-[#6B46C1]"
                />
                <div className="text-sm text-purple-200 mt-1">
                  Size: {chart.chartSize} (Will generate up to {chart.chartSize} charts)
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={chart.generateChart}
            disabled={
              !csv.selectedRows.size ||
              !csv.selectedColumns.size ||
              chart.chartLoading
            }
            className="w-full sm:w-auto px-4 py-2 bg-[#6B46C1] text-white rounded-md hover:bg-[#553C9A] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {chart.chartLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {chart.generatingCharts ? `Generating Chart ${chart.currentChartIndex + 1} of ${chart.chartSize}...` : 'Generating...'}
              </>
            ) : (
              <>
                <RiAiGenerate2 className="h-5 w-5" />
                Generate Charts
              </>
            )}
          </button>
          <ChartResults
            chartResults={chart.chartResults}
            currentChartIndex={chart.currentChartIndex}
            generatingCharts={chart.generatingCharts}
            chartSize={chart.chartSize}
            selectedData={csv.selectedData}
            onDownloadAll={chart.handleDownloadAllCharts}
          />
        </div>
      </div>
    </div>
  );
}
