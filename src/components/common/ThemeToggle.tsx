import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// ponytail: single source of truth theme toggle with clean mounted check
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme =
      (localStorage.getItem("meterly-theme") as "light" | "dark") ||
      (document.documentElement.getAttribute("data-theme") as
        | "light"
        | "dark") ||
      "dark";
    setTheme(savedTheme === "light" ? "light" : "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("meterly-theme", newTheme);

    document.documentElement.setAttribute("data-theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  if (!mounted) {
    return (
      <button
        className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface hover:bg-muted text-on-surface transition-colors"
        aria-label="Toggle theme"
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface hover:bg-muted text-on-surface transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
