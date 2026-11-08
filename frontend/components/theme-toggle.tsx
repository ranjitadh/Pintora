"use client";

import { useCallback, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("printora-theme") as Theme) || "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    localStorage.setItem("printora-theme", next);
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.classList.remove("dark");
    }
    setThemeState(next);
  }, [theme]);

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
        <Sun size={12} className="text-cream" />
      ) : (
        <Moon size={12} className="text-ink" />
      )}
      <span className={cn("text-xs", theme === "dark" ? "text-clay" : "text-ink")}>
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}