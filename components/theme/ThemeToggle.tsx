"use client";

import { MoonIcon, SunIcon } from "@/components/layout/icons";
import { useTheme } from "./ThemeProvider";

type Props = { className?: string; label?: string };

export default function ThemeToggle({ className = "", label = "Toggle theme" }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      title={label}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}
