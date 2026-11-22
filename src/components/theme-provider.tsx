"use client"

import type { ComponentProps } from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

import { createThemeScript } from "@/lib/theme-script"

function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  const options = {
    attribute: "class" as const,
    defaultTheme: "system",
    enableSystem: true,
    disableTransitionOnChange: true,
    ...props,
  }

  return (
    <>
      <script
        {...props.scriptProps}
        nonce={props.nonce}
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: createThemeScript(options) }}
      />
      <NextThemesProvider
        {...options}
        scriptProps={{ ...props.scriptProps, type: "text/plain" }}
      >
        {children}
      </NextThemesProvider>
    </>
  )
}

export { ThemeProvider }
