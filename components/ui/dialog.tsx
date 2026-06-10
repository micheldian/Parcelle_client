"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dialogue modal léger (API proche de shadcn/ui, sans dépendance Radix).
 * Usage : <Dialog open={open} onClose={...}><DialogContent>...</DialogContent></Dialog>
 */
interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function Dialog({ open, onClose, children }: DialogProps) {
  // Fermeture à la touche Échap
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* Fond semi-transparent : clic = fermeture */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-6 shadow-lg">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("mb-4 text-lg font-semibold", className)} {...props} />;
}

export { Dialog, DialogTitle };
