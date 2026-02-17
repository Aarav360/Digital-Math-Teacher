// Mock data and types for the Digital Math Teacher app

export type Problem = {
  id: string;
  title: string;
  topic: string;
  difficulty: number;
  type: string;
  estimatedTime: string;
  statement: string;
};

export type Session = {
  id: string;
  problemId: string;
  problemTitle: string;
  topic: string;
  status: "not_started" | "in_progress" | "completed";
  lastActivity: string;
  stepsCorrect: number;
  stepsTotal: number;
};

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

export const PROBLEMS: Problem[] = [
  { id: "1", title: "Solve for x: 2x + 5 = 13", topic: "Algebra 1", difficulty: 1, type: "Equations", estimatedTime: "5 min", statement: "Solve for x:\\n2x + 5 = 13" },
  { id: "2", title: "Factor: x² - 5x + 6", topic: "Algebra 1", difficulty: 2, type: "Equations", estimatedTime: "8 min", statement: "Factor the following expression:\\nx² - 5x + 6" },
  { id: "3", title: "Find the derivative of f(x) = 3x³ - 2x + 1", topic: "Calc 1", difficulty: 3, type: "Equations", estimatedTime: "10 min", statement: "Find the derivative of:\\nf(x) = 3x³ - 2x + 1" },
  { id: "4", title: "Evaluate: ∫(2x + 1)dx from 0 to 3", topic: "Calc 1", difficulty: 3, type: "Equations", estimatedTime: "12 min", statement: "Evaluate the definite integral:\\n∫₀³ (2x + 1) dx" },
  { id: "5", title: "Solve the system: x + y = 7, 2x - y = 2", topic: "Algebra 2", difficulty: 2, type: "Equations", estimatedTime: "10 min", statement: "Solve the system of equations:\\nx + y = 7\\n2x - y = 2" },
  { id: "6", title: "Prove: sin²θ + cos²θ = 1", topic: "Trig", difficulty: 3, type: "Proof/Reasoning", estimatedTime: "15 min", statement: "Prove the Pythagorean identity:\\nsin²θ + cos²θ = 1" },
  { id: "7", title: "Find eigenvalues of [[2,1],[1,2]]", topic: "Linear Algebra", difficulty: 4, type: "Equations", estimatedTime: "20 min", statement: "Find the eigenvalues of the matrix:\\nA = [[2, 1], [1, 2]]" },
  { id: "8", title: "Find the area between y = x² and y = x", topic: "Calc 1", difficulty: 3, type: "Word Problems", estimatedTime: "15 min", statement: "Find the area of the region bounded by:\\ny = x² and y = x" },
  { id: "9", title: "Simplify: (3x²y³)² / (9xy²)", topic: "Algebra 1", difficulty: 2, type: "Equations", estimatedTime: "5 min", statement: "Simplify the expression:\\n(3x²y³)² / (9xy²)" },
  { id: "10", title: "Find the limit: lim(x→0) sin(x)/x", topic: "Pre-Calc", difficulty: 3, type: "Equations", estimatedTime: "8 min", statement: "Evaluate the limit:\\nlim(x→0) sin(x)/x" },
];

export const SESSIONS: Session[] = [
  { id: "s1", problemId: "1", problemTitle: "Solve for x: 2x + 5 = 13", topic: "Algebra 1", status: "in_progress", lastActivity: "2026-02-14T10:30:00Z", stepsCorrect: 2, stepsTotal: 3 },
  { id: "s2", problemId: "3", problemTitle: "Find the derivative of f(x) = 3x³ - 2x + 1", topic: "Calc 1", status: "completed", lastActivity: "2026-02-13T14:20:00Z", stepsCorrect: 4, stepsTotal: 4 },
  { id: "s3", problemId: "5", problemTitle: "Solve the system: x + y = 7, 2x - y = 2", topic: "Algebra 2", status: "completed", lastActivity: "2026-02-12T09:15:00Z", stepsCorrect: 5, stepsTotal: 6 },
  { id: "s4", problemId: "6", problemTitle: "Prove: sin²θ + cos²θ = 1", topic: "Trig", status: "completed", lastActivity: "2026-02-11T16:45:00Z", stepsCorrect: 6, stepsTotal: 6 },
  { id: "s5", problemId: "4", problemTitle: "Evaluate: ∫(2x + 1)dx from 0 to 3", topic: "Calc 1", status: "completed", lastActivity: "2026-02-10T11:00:00Z", stepsCorrect: 3, stepsTotal: 5 },
  { id: "s6", problemId: "7", problemTitle: "Find eigenvalues of [[2,1],[1,2]]", topic: "Linear Algebra", status: "in_progress", lastActivity: "2026-02-09T08:30:00Z", stepsCorrect: 1, stepsTotal: 4 },
  { id: "s7", problemId: "9", problemTitle: "Simplify: (3x²y³)² / (9xy²)", topic: "Algebra 1", status: "completed", lastActivity: "2026-02-08T15:10:00Z", stepsCorrect: 3, stepsTotal: 3 },
  { id: "s8", problemId: "10", problemTitle: "Find the limit: lim(x→0) sin(x)/x", topic: "Pre-Calc", status: "completed", lastActivity: "2026-02-07T13:25:00Z", stepsCorrect: 2, stepsTotal: 3 },
  { id: "s9", problemId: "8", problemTitle: "Find the area between y = x² and y = x", topic: "Calc 1", status: "completed", lastActivity: "2026-02-06T10:00:00Z", stepsCorrect: 4, stepsTotal: 5 },
  { id: "s10", problemId: "2", problemTitle: "Factor: x² - 5x + 6", topic: "Algebra 1", status: "completed", lastActivity: "2026-02-05T09:45:00Z", stepsCorrect: 3, stepsTotal: 3 },
];

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
