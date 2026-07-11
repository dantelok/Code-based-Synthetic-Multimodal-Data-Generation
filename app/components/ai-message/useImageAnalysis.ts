import { useCallback, useEffect, useState } from "react";

type SetError = (message: string | null) => void;

/**
 * Handles the image-upload branch: creates a preview URL and requests VLM
 * analysis / Q&A pairs, and exposes a helper to export the Q&A as a text file.
 */
export function useImageAnalysis(
  fileType: "csv" | "image" | undefined,
  fileData: File | undefined,
  prompt: string | undefined,
  apiKey: string | undefined,
  setError: SetError,
) {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageAnalysis, setImageAnalysis] = useState<string>("");
  const [imageAnalysisLoading, setImageAnalysisLoading] = useState(false);

  useEffect(() => {
    if (fileType !== "image" || !fileData) return;

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
  }, [fileType, fileData, prompt, apiKey, setError]);

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
  }, [imageAnalysis, setError]);

  return { imageUrl, imageAnalysis, imageAnalysisLoading, handleDownloadQA };
}
