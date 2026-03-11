"use client";

import React, { forwardRef, useEffect, useMemo, useRef } from "react";
import type { MathfieldElement } from "mathlive";
import { cn } from "@/lib/utils";
import "mathlive";

export type MathLiveValue = {
  latex: string;
  text: string;
};

type MathLiveFieldProps = {
  value: string;
  onValueChange?: (value: MathLiveValue) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  readOnly?: boolean;
  multiline?: boolean;
  autoFocus?: boolean;
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  ariaLabel?: string;
};

export const MathLiveField = forwardRef<MathfieldElement, MathLiveFieldProps>(
  function MathLiveField(
    {
      value,
      onValueChange,
      placeholder,
      className,
      style,
      readOnly = false,
      multiline = false,
      autoFocus = false,
      onBlur,
      onKeyDown,
      ariaLabel,
    },
    ref,
  ) {
    const localRef = useRef<MathfieldElement | null>(null);
    const lastValueRef = useRef<string>("");
    const setRef = (node: MathfieldElement | null) => {
      localRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<MathfieldElement | null>).current = node;
      }
    };

    const fieldValue = useMemo(() => {
      const raw = value ?? "";
      return multiline ? stripDisplayLines(raw) : raw;
    }, [value, multiline]);
    const fieldStyle = useMemo(() => {
      const cssVars: React.CSSProperties = {
        ["--ML__textmode-background" as any]: "transparent",
        ["--ML__selection-background" as any]: "transparent",
        ["--ML__selection-color" as any]: "inherit",
        ["--selection-background-color" as any]: "transparent",
        ["--selection-color" as any]: "inherit",
        ["--highlight-text" as any]: "transparent",
        ["--contains-highlight-background-color" as any]: "transparent",
      };
      return style ? { ...cssVars, ...style } : cssVars;
    }, [style]);

    useEffect(() => {
      const field = localRef.current;
      if (!field) return;
      if (field.setOptions) {
        field.setOptions({
          smartMode: true,
          defaultMode: "text",
          smartFence: true,
          multiline,
          virtualKeyboardMode: "manual",
        });
      } else {
        field.smartMode = true;
        field.defaultMode = "text";
        field.smartFence = true;
        field.multiline = multiline;
        field.virtualKeyboardMode = "manual";
      }
      field.readOnly = readOnly;
      field.setAttribute("data-multiline", multiline ? "true" : "false");
      if (placeholder) {
        field.setAttribute("placeholder", formatPlaceholder(placeholder, multiline));
      } else {
        field.removeAttribute("placeholder");
      }
    }, [readOnly, placeholder, multiline]);

    useEffect(() => {
      const field = localRef.current;
      if (!field) return;
      const root = field.shadowRoot;
      if (!root) return;
      const styleId = "mathlive-no-highlight";
      if (root.getElementById(styleId)) return;
      const styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.textContent = `
        .ML__text, .ML__text * { background: transparent !important; box-shadow: none !important; }
        .ML__selection { background: transparent !important; color: inherit !important; }
        ::selection { background: transparent !important; color: inherit !important; }
        :host(.chat-math-input) .ML__text {
          white-space: normal !important;
          overflow-wrap: break-word !important;
        }
        :host(.chat-math-input) .ML__math,
        :host(.chat-math-input) .ML__math * {
          white-space: nowrap !important;
        }
      `;
      root.appendChild(styleEl);
    }, []);

    useEffect(() => {
      const field = localRef.current;
      if (!field) return;
      if (fieldValue === lastValueRef.current) return;
      if (field.setValue) {
        field.setValue(fieldValue, { silenceNotifications: true });
      } else {
        field.value = fieldValue;
      }
      lastValueRef.current = fieldValue;
    }, [fieldValue]);

    useEffect(() => {
      const field = localRef.current;
      if (!field || !onValueChange) return;
      const handleInput = () => {
        const raw = field.value ?? "";
        const latex = multiline ? stripDisplayLines(raw) : raw;
        const text =
          typeof field.getValue === "function"
            ? field.getValue("plain-text")
            : latex;
        lastValueRef.current = latex;
        onValueChange({ latex, text });
      };
      field.addEventListener("input", handleInput);
      return () => field.removeEventListener("input", handleInput);
    }, [onValueChange]);

    useEffect(() => {
      if (!autoFocus) return;
      const field = localRef.current;
      if (!field) return;
      const id = requestAnimationFrame(() => field.focus());
      return () => cancelAnimationFrame(id);
    }, [autoFocus]);

    return (
      <math-field
        ref={setRef}
        className={cn("mathlive-field", className)}
        style={fieldStyle}
        aria-label={ariaLabel}
        data-multiline={multiline ? "true" : "false"}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    );
  },
);

type MathLiveStaticProps = {
  latex: string;
  className?: string;
  block?: boolean;
  ariaLabel?: string;
};

export function MathLiveStatic({
  latex,
  className,
  block = false,
  ariaLabel,
}: MathLiveStaticProps) {
  if (block) {
    return (
      <math-div className={cn("mathlive-static", className)} aria-label={ariaLabel}>
        {latex}
      </math-div>
    );
  }
  return (
    <math-span className={cn("mathlive-static", className)} aria-label={ariaLabel}>
      {latex}
    </math-span>
  );
}
function stripDisplayLines(value: string) {
  const prefix = "\\displaylines{";
  const suffix = "}";
  if (value.startsWith(prefix) && value.endsWith(suffix)) {
    return value.slice(prefix.length, -suffix.length);
  }
  return value;
}

function formatPlaceholder(value: string, multiline: boolean) {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");
  const lines = escaped.split("\n").map((line) => `\\text{${line}}`);
  const content = lines.join(" \\\\ ");
  if (multiline && lines.length > 1) {
    return `\\displaylines{${content}}`;
  }
  return content;
}
