// Mock data and types for the Digital Math Teacher app

export type StepFeedback = {
  id: number;
  status: "correct" | "incorrect" | "warning";
  verdict: string;
  explanation: string;
  suggestion: string;
  latex: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type Template = {
  id: string;
  title: string;
  topic: string;
  description: string;
  icon: string;
  color: string;
};

export const TEMPLATES: Template[] = [
  { id: "t1", title: "Blank Whiteboard", topic: "Any", description: "Start from scratch with a clean slate", icon: "plus", color: "#e5e5ea" },
  { id: "t2", title: "Algebra", topic: "Algebra 1", description: "Equations, factoring, and simplification", icon: "variable", color: "#2A7BD4" },
  { id: "t3", title: "Calculus", topic: "Calc 1", description: "Derivatives, integrals, and limits", icon: "trending-up", color: "#34c759" },
  { id: "t4", title: "Trigonometry", topic: "Trig", description: "Identities, proofs, and unit circle", icon: "triangle", color: "#ff9500" },
  { id: "t5", title: "Linear Algebra", topic: "Linear Algebra", description: "Matrices, eigenvalues, and vectors", icon: "grid-3x3", color: "#af52de" },
  { id: "t6", title: "Word Problems", topic: "Any", description: "Apply math to real-world scenarios", icon: "file-text", color: "#ff2d55" },
];

export const MOCK_FEEDBACK: StepFeedback[] = [
  { id: 1, status: "correct", verdict: "Correct", explanation: "You correctly subtracted 5 from both sides.", suggestion: "", latex: "2x + 5 - 5 = 13 - 5" },
  { id: 2, status: "correct", verdict: "Correct", explanation: "Simplified correctly to get 2x = 8.", suggestion: "", latex: "2x = 8" },
  { id: 3, status: "incorrect", verdict: "Sign error", explanation: "When dividing both sides by 2, the result should be x = 4, not x = -4.", suggestion: "Double-check your division. 8 ÷ 2 = 4.", latex: "x = -4" },
];

export const TOPICS = ["All", "Algebra 1", "Geometry", "Algebra 2", "Trig", "Pre-Calc", "Calc 1", "Calc 2", "Calc 3", "Linear Algebra"];
export const DIFFICULTIES = [1, 2, 3, 4, 5];
export const PROBLEM_TYPES = ["All", "Equations", "Word Problems", "Proof/Reasoning"];

export const TUTOR_PERSONAS = [
  { id: "chill", name: "Chill Peer", description: "Feels like a classmate who's slightly ahead of you, casual but helpful." },
  { id: "calm", name: "Calm Teacher", description: "Speaks clearly and precisely, like a patient classroom teacher." },
  { id: "coach", name: "Encouraging Coach", description: "Focuses on motivation, praise, and gentle corrections." },
  { id: "strategist", name: "Exam Strategist", description: "Emphasizes efficient methods, common exam traps, and time-saving tricks." },
  { id: "curious", name: "Curious Co-learner", description: "Asks questions back, explores ideas with you, and encourages exploration." },
];
