import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FoodItem, MAX_SELECTIONS } from "./types";

interface DataTableProps {
  data: FoodItem[];
  headers: string[];
  selectedRows: Set<number>;
  selectedColumns: Set<string>;
  onRowSelect: (index: number) => void;
}

/** Scrollable data table with per-row selection checkboxes. */
function DataTable({ data, headers, selectedRows, selectedColumns, onRowSelect }: DataTableProps) {
  return (
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
                    onCheckedChange={() => onRowSelect(rowIndex)}
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
  );
}

export default React.memo(DataTable);
