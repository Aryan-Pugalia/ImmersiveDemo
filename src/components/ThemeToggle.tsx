import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  // When running inside the outer homepage nav (iframe), theme is controlled
  // centrally by the parent's sun/moon button — hide the inner toggle.
  if (window.self !== window.top) return null;

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="w-9 h-9 rounded-full border border-white/20 hover:border-white/50 hover:bg-white/10 transition-colors flex items-center justify-center text-white/70 hover:text-white"
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
