"use client";

import { useCallback, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "flex items-center gap-2 rounded-full bg-white border border-ink/20 px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-ink/5 transition",
        className
      )}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun size={14} className="text-cream" />
      ) : (
        <Moon size={14} className="text-ink" />
      )}
    </button>
  );
}