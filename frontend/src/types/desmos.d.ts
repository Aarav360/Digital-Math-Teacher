declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        element: HTMLElement,
        options?: Record<string, unknown>,
      ) => {
        setState: (state: unknown) => void;
        getState: () => unknown;
        screenshot: (opts?: { width?: number; height?: number; targetPixelRatio?: number }) => string;
        setBlank?: () => void;
        destroy: () => void;
      };
    };
  }
}

export {};
