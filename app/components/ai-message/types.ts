export interface FoodItem {
  [key: string]: string;
}

export interface ChartResult {
  type: string;
  code: string;
  image: string;
}

export const MAX_SELECTIONS = 10;
export const MIN_SELECTIONS = 1;

export const CHART_TYPES = [
  { value: "bar", label: "Bar Chart" },
  { value: "line", label: "Line Chart" },
  { value: "scatter", label: "Scatter Plot" },
  { value: "pie", label: "Pie Chart" },
  { value: "area", label: "Area Chart" },
  { value: "histogram", label: "Histogram" },
] as const;
