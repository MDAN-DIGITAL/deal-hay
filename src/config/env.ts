import { z } from "zod"
const apiUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const url = new URL(value)
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  }, "NEXT_PUBLIC_API_URL must be an HTTP(S) URL without credentials, query or fragment.")
export const env = {
  API_URL: apiUrl.parse(process.env.NEXT_PUBLIC_API_URL).replace(/\/+$/, ""),
}
export function apiAssetUrl(
  value: string | null | undefined
): string | undefined {
  if (!value) return undefined
  if (value.startsWith("/api/") || value.startsWith("/storage/"))
    return new URL(value, env.API_URL).href
  return value
}
