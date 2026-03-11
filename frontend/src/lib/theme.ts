export const getCssVar = (name: string, fallback = "") => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

export const resolveCssColor = (value: string, fallback = "") => {
  if (!value) return fallback;
  if (!value.startsWith("var(")) return value;
  const match = value.match(/var\((--[^)]+)\)/);
  if (!match) return fallback;
  return getCssVar(match[1], fallback);
};
