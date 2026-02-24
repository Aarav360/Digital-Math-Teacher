export type DraftNotebookProblem = {
  title: string;
  prompt: string;
  source_ref?: string | null;
  auto_title?: boolean;
};

type ParsedProblem = DraftNotebookProblem & {
  order_key?: number[];
};

const REF_PATTERN = /^(\d+(?:\.\d+)*)(?:\s*[-:]\s*)(.*)$/;

function deriveOrderKey(ref: string): number[] {
  return ref
    .split(".")
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));
}

export function parseBatchProblems(raw: string): ParsedProblem[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let autoIndex = 1;
  return lines.map((line) => {
    const match = line.match(REF_PATTERN);
    if (match) {
      const ref = match[1];
      const prompt = match[2] || "";
      return {
        title: `Problem ${ref}`,
        prompt,
        source_ref: ref,
        order_key: deriveOrderKey(ref),
      };
    }
    return {
      title: `Problem ${autoIndex++}`,
      prompt: line,
      auto_title: true,
    };
  });
}

function compareOrderKey(a: number[] = [], b: number[] = []) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function applyTextbookOrdering<T extends { source_ref?: string | null; order_index?: number; auto_title?: boolean; title?: string }>(
  problems: T[]
): Array<T & { order_index: number; title: string }> {
  const withRef = problems
    .filter((p) => p.source_ref)
    .map((p) => ({
      problem: p,
      order_key: deriveOrderKey(String(p.source_ref)),
    }))
    .sort((a, b) => compareOrderKey(a.order_key, b.order_key))
    .map((item) => item.problem);

  const withoutRef = problems.filter((p) => !p.source_ref);
  const ordered = [...withRef, ...withoutRef];
  let autoCounter = 1;
  return ordered.map((p, index) => {
    const shouldAutoTitle = p.auto_title === true;
    const nextTitle = shouldAutoTitle ? `Problem ${autoCounter++}` : (p.title ?? "");
    return {
      ...p,
      title: nextTitle,
      order_index: index,
    };
  });
}
