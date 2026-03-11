"use client";

import { useMemo } from "react";
import Aurora from "@/components/aurora";
import { getCssVar } from "@/lib/theme";
import { useTheme } from "@/hooks/useTheme";

export function AuroraBackground() {
  const { resolvedTheme } = useTheme();
  const colorStops = useMemo(() => {
    return [
      getCssVar("--aurora-1"),
      getCssVar("--aurora-2"),
      getCssVar("--aurora-3"),
    ];
  }, [resolvedTheme]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <Aurora
        colorStops={colorStops as [string, string, string]}
        blend={0.6}
        amplitude={1.0}
        speed={0.5}
      />
    </div>
  );
}
