const minimumVersions = {
  chrome: "120",
  edge: "120",
  firefox: "121",
  safari: "17.2",
  ios: "17.2",
  chromium: "120",
} as const

type SupportedBrowser = keyof typeof minimumVersions
export type BrowserFamily = SupportedBrowser | "legacy" | "unknown"
type Platform = "android" | "desktop" | "ios"

type BrowserCheck =
  | { status: "allowed" }
  | {
      status: "update"
      browser: SupportedBrowser
      name: string
      version: string
      minimum: string
      platform: Platform
    }
  | { status: "update"; browser: "legacy"; name: string; platform: Platform }
  | { status: "unverified"; browser: "unknown"; platform: Platform }

const iosBrowsers = [
  [/\bCriOS\/(\d+(?:\.\d+)*)\b/i, "chrome", "Google Chrome"],
  [/\bEdgiOS\/(\d+(?:\.\d+)*)\b/i, "edge", "Microsoft Edge"],
  [/\bFxiOS\/(\d+(?:\.\d+)*)\b/i, "firefox", "Firefox"],
] as const

const chromiumBrands = [
  [/\b(?:OPR|Opera)\//i, "opera", "Opera"],
  [/\bSamsungBrowser\//i, "samsung internet", "Samsung Internet"],
  [/\bVivaldi\//i, "vivaldi", "Vivaldi"],
  [/\bBrave\//i, "brave", "Brave"],
  [/\bYaBrowser\//i, "yandex", "Yandex Browser"],
  [/\bcoc_coc_browser\//i, "cốc cốc", "Cốc Cốc"],
] as const

const crawlerToken =
  /\b(?:Googlebot(?:-Image|-News|-Video)?|Mediapartners-Google|AdsBot-Google(?:-Mobile)?|bingbot|DuckDuckBot|YandexBot|Baiduspider|Slurp|facebookexternalhit|Twitterbot|LinkedInBot|Discordbot)\b/i

function isOlder(version: string, minimum: string): boolean {
  const [major, minor = "0"] = version.split(".", 2)
  const [minimumMajor, minimumMinor = "0"] = minimum.split(".")
  const majorDifference = Number(major) - Number(minimumMajor)

  return (
    majorDifference < 0 ||
    (majorDifference === 0 && Number(minor) < Number(minimumMinor))
  )
}

export function browserSupport(headers: Pick<Headers, "get">): BrowserCheck {
  const userAgent = headers.get("user-agent") ?? ""
  const ios =
    /\b(?:iPhone|iPad|iPod|CriOS|EdgiOS|FxiOS)\b|\bCPU OS \d|\bMacintosh\b.*\bMobile\//i.test(
      userAgent
    )
  const platform: Platform = ios
    ? "ios"
    : /\bAndroid\b/i.test(userAgent)
      ? "android"
      : "desktop"
  const unverified = {
    status: "unverified",
    browser: "unknown",
    platform,
  } as const

  const update = (
    browser: SupportedBrowser,
    name: string,
    version: string
  ): BrowserCheck => ({
    status: "update",
    browser,
    name,
    version,
    minimum: minimumVersions[browser],
    platform,
  })

  const check = (
    browser: SupportedBrowser,
    name: string,
    version: string
  ): BrowserCheck =>
    isOlder(version, minimumVersions[browser])
      ? update(browser, name, version)
      : { status: "allowed" }

  const safariVersion = userAgent.match(/\bVersion\/(\d+(?:\.\d+)*)\b/i)?.[1]
  if (platform === "ios") {
    // On iOS/iPadOS, the OS version identifies the available WebKit features.
    const osVersion = userAgent.match(
      /\b(?:CPU(?: iPhone)? OS|iPhone OS) (\d+(?:_\d+)*)/i
    )?.[1]
    const webkitVersion = osVersion?.replace(/_/g, ".") ?? safariVersion
    if (!webkitVersion) return unverified

    const webkit = check("ios", "iOS/iPadOS", webkitVersion)
    if (webkit.status !== "allowed") return webkit

    for (const [pattern, browser, name] of iosBrowsers) {
      const version = userAgent.match(pattern)?.[1]
      if (version) return check(browser, name, version)
    }
    return webkit
  }

  if (/\b(?:MSIE |Trident\/)/i.test(userAgent)) {
    return {
      status: "update",
      browser: "legacy",
      name: "Internet Explorer",
      platform,
    }
  }

  const edge = userAgent.match(/\b(?:EdgA?|Edge)\/(\d+(?:\.\d+)*)\b/i)?.[1]
  if (edge) return check("edge", "Microsoft Edge", edge)

  const firefox = userAgent.match(/\bFirefox\/(\d+(?:\.\d+)*)\b/i)?.[1]
  if (firefox) return check("firefox", "Firefox", firefox)

  const chrome = userAgent.match(
    /\b(Chrome|Chromium|HeadlessChrome)\/(\d+(?:\.\d+)*)\b/i
  )
  if (chrome) {
    const [, token, version] = chrome
    // Chromium forks and Android WebViews share the Chrome engine version.
    // The major version is available in both the full and reduced User-Agent.
    if (!isOlder(version, minimumVersions.chromium))
      return { status: "allowed" }

    const brands = (headers.get("sec-ch-ua") ?? "").toLowerCase()
    for (const [pattern, brand, name] of chromiumBrands) {
      if (pattern.test(userAgent) || brands.includes(`"${brand}"`)) {
        return update("chromium", name, version)
      }
    }

    if (platform === "android" && /; wv\)|\bVersion\/4\.0\b/i.test(userAgent)) {
      return update("chromium", "Android System WebView", version)
    }

    if (
      token.toLowerCase() === "chromium" ||
      (token.toLowerCase() === "chrome" &&
        brands.includes('"chromium"') &&
        !brands.includes('"google chrome"'))
    ) {
      return update("chromium", "Chromium", version)
    }

    return update("chrome", "Google Chrome", version)
  }

  if (
    platform === "desktop" &&
    safariVersion &&
    /\bSafari\//i.test(userAgent)
  ) {
    return check("safari", "Safari", safariVersion)
  }

  // Search crawlers and link previews may omit a browser version altogether.
  if (crawlerToken.test(userAgent)) return { status: "allowed" }

  return unverified
}
