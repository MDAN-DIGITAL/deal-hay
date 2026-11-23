const minimumVersions = {
  chrome: "120",
  edge: "120",
  firefox: "121",
  safari: "17.2",
  ios: "17.2",
  chromium: "120",
}

export type BrowserFamily = keyof typeof minimumVersions | "legacy" | "unknown"

type BrowserCheck = (
  | { status: "allowed" }
  | {
      status: "update" | "unverified"
      browser: BrowserFamily
      name: string
      version: string
      minimum: string
      android: boolean
    }
) & { fullVersionHint?: true }

export const FULL_BROWSER_VERSION_HINT = "Sec-CH-UA-Full-Version-List"

function versionToken(userAgent: string, token: string): string | undefined {
  return userAgent.match(
    new RegExp(`\\b(?:${token})/([0-9]+(?:\\.[0-9]+){0,3})`, "i")
  )?.[1]
}

function brandVersions(header: string) {
  return new Map(
    Array.from(
      header.matchAll(/"([^"]+)";\s*v="(\d+(?:\.\d+){0,3})"/g),
      ([, brand, version]) => [brand.toLowerCase(), version]
    )
  )
}

function isOlder(version: string, minimum: string): boolean {
  const actualParts = version.split(".").map(Number)
  const minimumParts = minimum.split(".").map(Number)

  for (let index = 0; index < 4; index++) {
    const difference = (actualParts[index] ?? 0) - (minimumParts[index] ?? 0)

    if (difference !== 0) return difference < 0
  }

  return false
}

const chromiumBrands = [
  ["OPR|Opera", "Opera", "opera"],
  ["SamsungBrowser", "Samsung Internet", "samsung internet"],
  ["Vivaldi", "Vivaldi", "vivaldi"],
  ["Brave", "Brave", "brave"],
  ["YaBrowser", "Yandex Browser", "yandex"],
  ["coc_coc_browser", "Cốc Cốc", "cốc cốc"],
] as const

export function browserSupport(headers: Pick<Headers, "get">): BrowserCheck {
  const userAgent = headers.get("user-agent") ?? ""

  // Allow search engine bots and crawlers.
  if (/bot\b|crawler\b|spider\b|slurp\b|facebookexternalhit/i.test(userAgent)) {
    return { status: "allowed" }
  }

  const android = /\bAndroid\b/i.test(userAgent)

  const check = (
    browser: keyof typeof minimumVersions,
    name: string,
    version: string
  ): BrowserCheck => {
    const minimum = minimumVersions[browser]

    return isOlder(version, minimum)
      ? {
          status: "update",
          browser,
          name,
          version,
          minimum,
          android,
        }
      : { status: "allowed" }
  }

  // Detect iOS/iPadOS version.
  // Browser versions on iOS do not identify the OS WebKit release.
  const iosVersion = userAgent.match(
    /\b(?:CPU(?: iPhone)? OS|iPhone OS) (\d+(?:_\d+)*)/i
  )?.[1]

  const safariVersion = versionToken(userAgent, "Version")

  if (iosVersion) {
    return check("ios", "iOS/iPadOS", iosVersion.replace(/_/g, "."))
  }

  // Detect iPadOS desktop mode.
  if (safariVersion && /\bMacintosh\b.*\bMobile\//i.test(userAgent)) {
    return check("ios", "iOS/iPadOS", safariVersion)
  }

  // Microsoft Edge.
  const edge = versionToken(userAgent, "Edg|EdgA")

  if (edge) {
    return check("edge", "Microsoft Edge", edge)
  }

  // Mozilla Firefox.
  const firefox = versionToken(userAgent, "Firefox")

  if (firefox) {
    return check("firefox", "Firefox", firefox)
  }

  // Legacy Microsoft Edge.
  const legacyEdge = versionToken(userAgent, "Edge")

  if (legacyEdge) {
    return check("edge", "Microsoft Edge", legacyEdge)
  }

  // Chrome, Chromium and Chromium-based browsers.
  const chrome = versionToken(userAgent, "Chrome|Chromium|HeadlessChrome")

  if (chrome) {
    const brands = brandVersions(headers.get("sec-ch-ua") ?? "")

    const fullVersions = brandVersions(
      headers.get(FULL_BROWSER_VERSION_HINT) ?? ""
    )

    // Detect Chromium-based browsers.
    for (const [token, name, brand] of chromiumBrands) {
      if (
        versionToken(userAgent, token) ||
        brands.has(brand) ||
        fullVersions.has(brand)
      ) {
        return check("chromium", name, chrome)
      }
    }

    // Android System WebView.
    if (android && /; wv\)|\bVersion\/4\.0\b/.test(userAgent)) {
      return check("chromium", "Android System WebView", chrome)
    }

    // Detect Chromium.
    if (
      /\bChromium\//.test(userAgent) ||
      (brands.has("chromium") &&
        !brands.has("google chrome") &&
        !brands.has("headlesschrome") &&
        !fullVersions.has("google chrome") &&
        !/\bHeadlessChrome\//.test(userAgent))
    ) {
      return check("chromium", "Chromium", chrome)
    }

    // Google Chrome.
    // Major version 120 or higher is sufficient.
    return check("chrome", "Google Chrome", chrome)
  }

  // Safari on macOS.
  if (safariVersion && /\bSafari\//.test(userAgent)) {
    return check("safari", "Safari", safariVersion)
  }

  // Internet Explorer.
  const legacy = userAgent
    .match(/\bMSIE (\d+(?:\.\d+)?)|\bTrident\/.*\brv:(\d+(?:\.\d+)?)/)
    ?.slice(1)
    .find(Boolean)

  if (legacy) {
    return {
      status: "update",
      browser: "legacy",
      name: "Internet Explorer",
      version: legacy,
      minimum: "120",
      android,
    }
  }

  // Unknown or unsupported browser.
  return {
    status: "unverified",
    browser: "unknown",
    name: "Unknown browser",
    version: "Unknown",
    minimum: "120",
    android,
  }
}
