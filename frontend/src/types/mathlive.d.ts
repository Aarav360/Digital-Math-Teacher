import type { MathfieldElement } from "mathlive";

declare namespace JSX {
  interface IntrinsicElements {
    "math-field": React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement> & {
      readOnly?: boolean;
      readonly?: boolean;
      placeholder?: string;
    };
    "math-span": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    "math-div": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}

