import * as React from "react";
import { cn } from "@/lib/utils";

/** Barre de progression (0–100). */
function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-3 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export { Progress };
