"use client";

import Aurora from "@/components/aurora";

export function AuroraBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <Aurora
        colorStops={["#3b82f6", "#a78bfa", "#2A7BD4"]}
        blend={0.6}
        amplitude={1.0}
        speed={0.5}
      />
    </div>
  );
}
