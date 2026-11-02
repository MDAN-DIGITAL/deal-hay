type SiteEnvironment = {
  NEXT_PUBLIC_SITE_URL?: string
  VERCEL_PROJECT_PRODUCTION_URL?: string
}

function parseOrigin(
  value: string | undefined,
  hostnameOnly = false
): URL | null {
  if (!value?.trim()) return null
  try {
    const input = value.trim()
    if (hostnameOnly && !input.includes("://") && /[\\/\s]/.test(input))
      return null
    const url = new URL(
      hostnameOnly && !input.includes("://") ? `https://${input}` : input
    )
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null
    return new URL(url.origin)
  } catch {
    return null
  }
}

/** Canonical URLs always use a validated origin, never a request Host header. */
export function resolveSiteUrl(environment: SiteEnvironment): URL {
  return (
    parseOrigin(environment.NEXT_PUBLIC_SITE_URL) ??
    parseOrigin(environment.VERCEL_PROJECT_PRODUCTION_URL, true) ??
    new URL("https://dealhay.vercel.app")
  )
}

export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
})
