import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/lib/theme-script.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
)
const { createThemeScript } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
)

function initialize({
  stored,
  dark = false,
  blocked = false,
  ...options
} = {}) {
  const classes = new Set(["antialiased", "light"])
  const attributes = new Map()
  const style = {}
  runInNewContext(createThemeScript({ attribute: "class", ...options }), {
    document: {
      documentElement: {
        classList: {
          remove: (...items) => items.forEach((item) => classes.delete(item)),
          add: (item) => classes.add(item),
        },
        setAttribute: (name, value) => attributes.set(name, value),
        style,
      },
    },
    localStorage: {
      getItem(key) {
        assert.equal(key, options.storageKey ?? "theme")
        if (blocked) throw new Error("storage blocked")
        return stored ?? null
      },
    },
    window: {
      matchMedia(query) {
        assert.equal(query, "(prefers-color-scheme: dark)")
        return { matches: dark }
      },
    },
  })
  return { classes: [...classes], attributes, style }
}

test("theme bootstrap runs without bundler helpers and preserves unrelated classes", () => {
  for (const stored of ["light", "dark"]) {
    const result = initialize({ stored, dark: stored === "light" })
    assert.deepEqual(result.classes, ["antialiased", stored])
    assert.equal(result.style.colorScheme, stored)
  }
})

test("system theme works on first visit, with a saved preference and blocked storage", () => {
  for (const dark of [false, true]) {
    for (const options of [{}, { stored: "system" }, { blocked: true }]) {
      const result = initialize({ dark, ...options })
      assert.equal(result.style.colorScheme, dark ? "dark" : "light")
    }
  }
})

test("forced theme, custom attributes and theme values match provider options", () => {
  const result = initialize({
    forcedTheme: "dark",
    stored: "light",
    attribute: ["class", "data-theme"],
    value: { light: "light", dark: "night" },
    enableColorScheme: false,
  })
  assert.deepEqual(result.classes, ["antialiased", "night"])
  assert.equal(result.attributes.get("data-theme"), "night")
  assert.equal(result.style.colorScheme, undefined)

  assert.equal(
    initialize({ enableSystem: false, storageKey: "custom-theme", dark: true })
      .style.colorScheme,
    "light"
  )
})

test("theme options cannot close the inline script element", () => {
  const forcedTheme = "</script><script>alert(1)</script>\u2028\u2029"
  const script = createThemeScript({ forcedTheme })
  assert.equal(script.includes("<"), false)
  assert.equal(script.includes("\u2028"), false)
  assert.equal(script.includes("\u2029"), false)
  assert.equal(
    initialize({ forcedTheme, attribute: "data-theme" }).attributes.get(
      "data-theme"
    ),
    forcedTheme
  )
})
