import type { ThemeProviderProps } from "next-themes"

// Keep the bootstrap as text: serializing a compiled function can leak bundler
// helpers such as __name into the browser without their definitions.
const bootstrap = `((attribute, storageKey, defaultTheme, forcedTheme, themes, value, enableSystem, enableColorScheme) => {
  let theme = forcedTheme;
  if (!theme) {
    try { theme = localStorage.getItem(storageKey); } catch {}
    theme = theme || defaultTheme;
    if (enableSystem && theme === "system") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  }
  const element = document.documentElement;
  const attributes = Array.isArray(attribute) ? attribute : [attribute];
  for (const name of attributes) {
    const themeValue = value && value[theme] ? value[theme] : theme;
    if (name === "class") {
      const classes = value ? themes.map(item => value[item] || item) : themes;
      element.classList.remove(...classes);
      element.classList.add(themeValue);
    } else {
      element.setAttribute(name, themeValue);
    }
  }
  if (enableColorScheme && (theme === "light" || theme === "dark")) {
    element.style.colorScheme = theme;
  }
})`

export function createThemeScript({
  attribute = "data-theme",
  storageKey = "theme",
  enableSystem = true,
  defaultTheme = enableSystem ? "system" : "light",
  forcedTheme,
  themes = ["light", "dark"],
  value,
  enableColorScheme = true,
}: Omit<ThemeProviderProps, "children"> = {}) {
  const args = JSON.stringify([
    attribute,
    storageKey,
    defaultTheme,
    forcedTheme,
    themes,
    value,
    enableSystem,
    enableColorScheme,
  ])
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")

  return `${bootstrap}(${args.slice(1, -1)})`
}
