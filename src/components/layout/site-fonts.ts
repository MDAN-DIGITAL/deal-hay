import { Geist_Mono, Inter } from "next/font/google"

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
})
const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  preload: false,
})

export const siteFontVariables = `${inter.variable} ${fontMono.variable}`
