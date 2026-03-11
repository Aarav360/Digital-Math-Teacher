import { getCssVar, resolveCssColor } from "@/lib/theme";

type Stroke = {
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  tool: "pen" | "eraser" | "eraserPartial" | "highlighter";
};

type ShapeItem = {
  type: "line" | "rectangle" | "circle" | "arrow";
  start: { x: number; y: number };
  end: { x: number; y: number };
  color: string;
  width: number;
};

type TextItem = {
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};

type ImageItem = {
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
};

type GraphItem = {
  x: number;
  y: number;
  width: number;
  height: number;
  thumbnailDataUrl: string;
};

type SnapshotPayload = {
  strokes_json: {
    strokes?: Stroke[];
    shapes?: ShapeItem[];
    textItems?: TextItem[];
    imageItems?: ImageItem[];
    graphItems?: GraphItem[];
  };
  width: number;
  height: number;
};

function drawShape(ctx: CanvasRenderingContext2D, s: ShapeItem, overrideColor?: string) {
  ctx.strokeStyle = overrideColor ?? s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const x0 = s.start.x, y0 = s.start.y, x1 = s.end.x, y1 = s.end.y;
  if (s.type === "line" || s.type === "arrow") {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (s.type === "arrow") {
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const len = 12;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - len * Math.cos(angle - 0.4), y1 - len * Math.sin(angle - 0.4));
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - len * Math.cos(angle + 0.4), y1 - len * Math.sin(angle + 0.4));
      ctx.stroke();
    }
  } else if (s.type === "rectangle") {
    ctx.strokeRect(
      Math.min(x0, x1),
      Math.min(y0, y1),
      Math.abs(x1 - x0),
      Math.abs(y1 - y0),
    );
  } else if (s.type === "circle") {
    const r = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    ctx.beginPath();
    ctx.arc(x0, y0, r, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

export async function downloadSnapshotAsPng(
  snapshot: SnapshotPayload,
  filename = "whiteboard.png",
) {
  if (typeof document === "undefined") return;
  const { width, height, strokes_json } = snapshot;
  if (!width || !height) return;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const canvasBg = getCssVar("--canvas-bg");
  const inkDefault = getCssVar("--ink-default");
  const resolveColor = (value: string) => resolveCssColor(value || "", inkDefault || value);
  if (canvasBg) {
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, width, height);
  }

  const strokes = strokes_json.strokes ?? [];
  const shapes = strokes_json.shapes ?? [];
  const textItems = strokes_json.textItems ?? [];
  const imageItems = strokes_json.imageItems ?? [];
  const graphItems = strokes_json.graphItems ?? [];

  for (const item of imageItems) {
    try {
      const img = await loadImage(item.dataUrl);
      ctx.drawImage(img, item.x, item.y, item.width, item.height);
    } catch {
      // Skip failed image in export
    }
  }

  for (const item of graphItems) {
    try {
      const img = await loadImage(item.thumbnailDataUrl);
      ctx.drawImage(img, item.x, item.y, item.width, item.height);
    } catch {
      // Skip failed graph thumbnail in export
    }
  }

  for (const shape of shapes) {
    drawShape(ctx, shape, resolveColor(shape.color));
  }

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.strokeStyle =
      stroke.tool === "eraser" || stroke.tool === "eraserPartial"
        ? canvasBg || inkDefault
        : resolveColor(stroke.color);
    ctx.lineWidth =
      stroke.tool === "eraser"
        ? stroke.width * 5
        : stroke.tool === "eraserPartial"
          ? stroke.width * 2
          : stroke.tool === "highlighter"
            ? stroke.width * 4
            : stroke.width;
    if (stroke.tool === "highlighter") ctx.globalAlpha = 0.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const lineHeight = 1.2;
  ctx.textBaseline = "top";
  for (const t of textItems) {
    ctx.font = `${t.fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = resolveColor(t.color);
    const lines = t.text.split("\n");
    let y = t.y;
    for (const line of lines) {
      ctx.fillText(line, t.x, y);
      y += t.fontSize * lineHeight;
    }
  }

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
