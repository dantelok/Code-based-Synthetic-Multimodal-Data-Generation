"use client";

import React, { useState } from "react";
import { useCsvData } from "./ai-message/useCsvData";
import { useChartGeneration } from "./ai-message/useChartGeneration";
import { useImageAnalysis } from "./ai-message/useImageAnalysis";
import CsvView from "./ai-message/CsvView";
import ImageView from "./ai-message/ImageView";

interface AiMessageProps {
  fileType?: "csv" | "image";
  fileData?: File;
  prompt?: string;
  apiKey?: string;
}

/**
 * Renders the assistant's response to an uploaded CSV or image. The heavy
 * lifting lives in focused hooks (`useCsvData`, `useChartGeneration`,
 * `useImageAnalysis`) and presentational views (`CsvView`, `ImageView`);
 * this component just wires them together and picks a branch.
 */
const AiMessage: React.FC<AiMessageProps> = ({ fileType, fileData, prompt, apiKey }) => {
  const [error, setError] = useState<string | null>(null);

  const csv = useCsvData(fileType, fileData, setError);
  const chart = useChartGeneration({
    selectedData: csv.selectedData,
    rowCount: csv.selectedRows.size,
    colCount: csv.selectedColumns.size,
    prompt,
    apiKey,
    setError,
  });
  const image = useImageAnalysis(fileType, fileData, prompt, apiKey, setError);

  if (fileType === "csv") {
    return <CsvView error={error} csv={csv} chart={chart} />;
  }

  if (fileType === "image" && image.imageUrl) {
    return (
      <ImageView
        error={error}
        prompt={prompt}
        imageUrl={image.imageUrl}
        imageAnalysis={image.imageAnalysis}
        imageAnalysisLoading={image.imageAnalysisLoading}
        handleDownloadQA={image.handleDownloadQA}
      />
    );
  }

  return null;
};

export default React.memo(AiMessage);
