export type PublicMediaRemotePattern = {
  protocol: "http" | "https"
  hostname: string
  port: string
  pathname: string
  search: string
}

function parseApiUrl(value: string | undefined): URL | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }

    return url
  } catch {
    return null
  }
}

function publicMediaPath(apiUrl: URL, suffix: string): string {
  const basePath = apiUrl.pathname.replace(/\/+$/, "")
  return `${basePath}/media/assets/${suffix}`
}

export function publicMediaRemotePattern(
  apiBaseUrl: string | undefined
): PublicMediaRemotePattern | null {
  const apiUrl = parseApiUrl(apiBaseUrl)
  if (!apiUrl) return null

  return {
    protocol: apiUrl.protocol.slice(0, -1) as "http" | "https",
    hostname: apiUrl.hostname,
    port: apiUrl.port,
    pathname: publicMediaPath(apiUrl, "**"),
    search: "",
  }
}

export function isPublicMediaAssetUrl(
  value: string,
  apiBaseUrl: string
): boolean {
  const apiUrl = parseApiUrl(apiBaseUrl)
  if (!apiUrl) return false

  try {
    const candidate = new URL(value)
    const prefix = publicMediaPath(apiUrl, "")

    return (
      candidate.origin === apiUrl.origin &&
      !candidate.username &&
      !candidate.password &&
      !candidate.search &&
      !candidate.hash &&
      candidate.pathname.startsWith(prefix) &&
      candidate.pathname.length > prefix.length
    )
  } catch {
    return false
  }
}
