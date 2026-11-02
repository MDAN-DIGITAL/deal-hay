import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@base-ui/react", "@base-ui/react/*"],
              message:
                "Import the styled Deal Hay component from @/components/ui instead of the underlying library.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name=/^(button|select|textarea)$/]",
          message:
            "Use the shared primitive from @/components/ui so appearance and accessibility stay consistent.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value='file']))",
          message:
            "Use Input or Checkbox from @/components/ui. Native file inputs are the only exception.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='Input']:has(JSXAttribute[name.name='type'][value.value=/^(date|datetime-local|month|week|time)$/])",
          message:
            "Use DatePicker from @/components/ui/date-picker instead of a browser date/time picker.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
])

export default eslintConfig
