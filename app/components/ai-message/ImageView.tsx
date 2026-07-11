import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import AiAvatar from "./AiAvatar";

interface ImageViewProps {
  error: string | null;
  prompt?: string;
  imageUrl: string;
  imageAnalysis: string;
  imageAnalysisLoading: boolean;
  handleDownloadQA: () => void;
}

/** The image branch: preview plus VLM analysis or generated Q&A pairs. */
export default function ImageView({
  error,
  prompt,
  imageUrl,
  imageAnalysis,
  imageAnalysisLoading,
  handleDownloadQA,
}: ImageViewProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      <AiAvatar />
      <div className="flex-1">
        <Card className="overflow-hidden bg-transparent border-none">
          <CardContent className="p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
