export type Tool =
  | "pen"
  | "eraser"
  | "eraserPartial"
  | "highlighter"
  | "hand"
  | "text"
  | "lasso"
  | "selectionBox"
  | "line"
  | "rectangle"
  | "circle"
  | "arrow";

export type Point = { x: number; y: number };

export type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: "pen" | "eraser" | "eraserPartial" | "highlighter";
};

export type ShapeItem = {
  id: string;
  type: "line" | "rectangle" | "circle" | "arrow";
  start: Point;
  end: Point;
  color: string;
  width: number;
};

export type TextItem = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};

export type ImageItem = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
};

export type SessionProblem = {
  id: string;
  title: string;
  topic: string;
  difficulty: number;
  type: string;
  estimatedTime?: string | null;
  statement: string;
};

export type SessionNotebookProblem = {
  id: string;
  notebook_id: string;
  title: string;
  prompt: string | null;
};

export type HistoryEntry =
  | { kind: "stroke"; item: Stroke }
  | { kind: "shape"; item: ShapeItem }
  | { kind: "text"; item: TextItem }
  | { kind: "image"; item: ImageItem }
  | { kind: "paste"; strokes: Stroke[]; shapes: ShapeItem[]; textItems: TextItem[]; imageItems: ImageItem[] }
  | {
      kind: "delete";
      strokes: Stroke[];
      shapes: ShapeItem[];
      textItems: TextItem[];
      imageItems: ImageItem[];
    };
