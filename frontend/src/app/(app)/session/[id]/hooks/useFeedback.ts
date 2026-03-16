import { useState, useRef, useCallback, useEffect } from "react";
import type { StepFeedback } from "@/lib/data";
import { analyzeSteps } from "@/lib/api";
import type { SnapshotPersistence } from "./useSnapshotPersistence";

interface FeedbackArgs {
  isBlank: boolean;
  currentUser: { id: string } | null | undefined;
  persistence: SnapshotPersistence;
  sessionId: string;
  exportCanvasToBase64: () => Promise<string | null>;
}

export function useFeedback({ isBlank, currentUser, persistence, sessionId, exportCanvasToBase64 }: FeedbackArgs) {
  const { forceImmediateSave } = persistence;

  const [showCheckButton, setShowCheckButton] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeText, setAnalyzeText] = useState("Reading your steps...");
  const [feedback, setFeedback] = useState<StepFeedback[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAnalyzingRef = useRef(false);
  const handleCheckStepsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const handleCheckSteps = useCallback(async () => {
    if (isAnalyzingRef.current) return;
    setShowCheckButton(false);
    setIsAnalyzing(true);
    isAnalyzingRef.current = true;
    setErrorMessage(null);
    try {
      // 1. Save current snapshot
      if (!isBlank && currentUser) {
        setAnalyzeText("Saving your work...");
        await forceImmediateSave();
      }

      // 2. Export canvas to base64
      setAnalyzeText("Capturing your whiteboard...");
      const imageBase64 = await exportCanvasToBase64();

      // 3. Call backend grading pipeline
      setAnalyzeText("Analyzing your steps...");
      const result = await analyzeSteps({
        session_id: sessionId,
        image_base64: imageBase64 ?? undefined,
      });

      if (!result.ok) {
        throw new Error(result.error || "Analysis failed");
      }

      // 4. Map StepRead[] → StepFeedback[]
      const mapped: StepFeedback[] = result.data.steps.map((s) => ({
        id: s.step_index + 1,
        status: (s.evaluation?.status ?? "warning") as StepFeedback["status"],
        verdict: s.evaluation?.verdict ?? "Pending",
        explanation: s.evaluation?.explanation ?? "",
        suggestion: s.evaluation?.suggestion ?? "",
        latex: s.latex_raw ?? "",
      }));

      setFeedback(mapped);
      setCurrentStep(0);
    } catch (err) {
      console.error("Check steps failed:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to analyze steps. Please try again."
      );
    } finally {
      setIsAnalyzing(false);
      isAnalyzingRef.current = false;
    }
  }, [isBlank, currentUser, forceImmediateSave, sessionId, exportCanvasToBase64]);

  useEffect(() => {
    handleCheckStepsRef.current = handleCheckSteps;
  }, [handleCheckSteps]);

  /** Clear feedback state (called by orchestrator on clearAll). */
  const clear = useCallback(() => {
    if (isAnalyzingRef.current) return;
    setAnalyzeText("");
    setCurrentStep(0);
    setExpandedStep(null);
    setFeedback([]);
    setShowCheckButton(false);
    setErrorMessage(null);
    setIsAnalyzing(false);
  }, []);

  return {
    showCheckButton,
    setShowCheckButton,
    isAnalyzing,
    analyzeText,
    feedback,
    setFeedback,
    currentStep,
    setCurrentStep,
    expandedStep,
    setExpandedStep,
    errorMessage,
    setErrorMessage,
    handleCheckSteps,
    handleCheckStepsRef,
    clear,
  };
}
