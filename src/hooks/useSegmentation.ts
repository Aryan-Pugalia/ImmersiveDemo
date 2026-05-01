import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SegmentationResult } from "@/types/segmentation";

export function useSegmentation() {
  const [result, setResult] = useState<SegmentationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (file: File) => {
    if (!supabase) {
      setError("AI analysis is not configured in this environment.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error: fnError } = await supabase.functions.invoke("analyze-medical-image", {
        body: { imageBase64: base64, mimeType: file.type },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const parsed = data as SegmentationResult;
      if (!Array.isArray(parsed?.regions)) {
        setError("Unexpected response from AI analysis. Please try again.");
        return;
      }
      setResult(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, analyze, setResult };
}
