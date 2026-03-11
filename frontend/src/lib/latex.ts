const LATEX_COMMAND_RE = /\\[a-zA-Z]+/;
const LATEX_SPECIAL_RE = /[_^{}]/;

const stripMathDelimiters = (value: string) =>
  value
    .trim()
    .replace(/^\${1,2}\s*/, "")
    .replace(/\s*\${1,2}$/, "");

const escapeLatexText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/&/g, "\\&")
    .replace(/\$/g, "\\$")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\^/g, "\\textasciicircum ")
    .replace(/~/g, "\\textasciitilde ");

const looksLikeLatex = (value: string) =>
  LATEX_COMMAND_RE.test(value) || LATEX_SPECIAL_RE.test(value);

export const isLatexLike = (value: string) => {
  const raw = (value ?? "").trim();
  if (!raw) return false;
  return looksLikeLatex(stripMathDelimiters(raw));
};

export const normalizeLatexForDisplay = (value: string) => {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const stripped = stripMathDelimiters(raw);
  if (looksLikeLatex(stripped)) return stripped;
  return `\\text{${escapeLatexText(stripped)}}`;
};
