import { useState, useRef, useCallback, useEffect } from "react";
import { MOCK_FEEDBACK, type StepFeedback } from "@/lib/data";
import type { SnapshotPersistence } from "./useSnapshotPersistence";

interface FeedbackArgs {
  isBlank: boolean;
  currentUser: { id: string } | null | undefined;
  persistence: SnapshotPersistence;
}

export function useFeedback({ isBlank, currentUser, persistence }: FeedbackArgs) {
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
      if (!isBlank && currentUser) {
        await forceImmediateSave();
      }
      const texts = [
        "Reading your steps...",
        "Analyzing your work...",
        "Reviewing step 2...",
        "Almost done...",
      ];
      for (let i = 0; i < texts.length; i++) {
        setAnalyzeText(texts[i]);
        await new Promise<void>((r) => setTimeout(r, 800));
      }
      setFeedback(MOCK_FEEDBACK);
      setCurrentStep(0);
    } catch (err) {
      console.error("Check steps failed:", err);
      setErrorMessage("Failed to analyze steps. Please try again.");
    } finally {
      setIsAnalyzing(false);
      isAnalyzingRef.current = false;
    }
  }, [isBlank, currentUser, forceImmediateSave]);

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
