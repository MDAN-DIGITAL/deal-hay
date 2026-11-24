import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import ts from "typescript"

import { browserSupport } from "../src/lib/browser-support.ts"

const require = createRequire(import.meta.url)
const { NextRequest } = require("next/server")
const {
  getRewrittenUrl,
  unstable_doesMiddlewareMatch,
} = require("next/experimental/testing/server")
const proxySource = ts
  .transpileModule(
    readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  .outputText.replace(
    '"next/server"',
    JSON.stringify(import.meta.resolve("next/server.js"))
  )
  .replace(
    '"@/lib/browser-support"',
    JSON.stringify(new URL("../src/lib/browser-support.ts", import.meta.url))
  )
const { config, proxy } = await import(
  `data:text/javascript;base64,${Buffer.from(proxySource).toString("base64")}`
)

function check(userAgent, extra) {
  return browserSupport(new Headers({ "user-agent": userAgent, ...extra }))
}

const oldChrome = "Mozilla/5.0 Chrome/119.0.0.0 Safari/537.36"
const reducedChrome = "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36"
const oldSafari = "Mozilla/5.0 (Macintosh) Version/17.1.2 Safari/605.1.15"

test("Chrome uses the major version without a full-version Client Hint", () => {
  assert.equal(check(oldChrome).status, "update")
  for (const version of ["120", "120.0.0.0", "120.0.6099.62", "121.0.0.0"])
    assert.equal(check(`Chrome/${version}`).status, "allowed", version)

  assert.equal(
    check(oldChrome, {
      "sec-ch-ua-full-version-list": '"Google Chrome";v="120.0.6099.62"',
    }).status,
    "update"
  )
})

test("equivalent browsers use their own releases or the Chromium/WebKit version", () => {
  for (const [oldAgent, newAgent, name] of [
    [
      "Chrome/119.0.0.0 Edg/119.0.0.0",
      "Chrome/120.0.0.0 Edg/120.0.0.0",
      "Microsoft Edge",
    ],
    [
      "(Android 10) Chrome/119.0.0.0 EdgA/119.0.0.0",
      "(Android 10) Chrome/120.0.0.0 EdgA/120.0.0.0",
      "Microsoft Edge",
    ],
    ["Firefox/120.0", "Firefox/121.0", "Firefox"],
    ["(Android 13) Firefox/120.0", "(Android 13) Firefox/121.0", "Firefox"],
    [oldSafari, "Version/17.2 Safari/605.1.15", "Safari"],
    [
      "(iPhone; CPU iPhone OS 17_1_2 like Mac OS X) CriOS/120.0.0.0",
      "(iPhone; CPU iPhone OS 17_2 like Mac OS X) CriOS/120.0.0.0",
      "iOS/iPadOS",
    ],
    [
      "(iPhone; CPU iPhone OS 17_2 like Mac OS X) CriOS/119.0.0.0",
      "(iPhone; CPU iPhone OS 17_2 like Mac OS X) CriOS/120.0.0.0",
      "Google Chrome",
    ],
    [
      "(Macintosh) CriOS/119 Version/17.2 Safari/605.1.15",
      "(Macintosh) CriOS/120 Version/17.2 Safari/605.1.15",
      "Google Chrome",
    ],
    [
      "(iPhone; CPU iPhone OS 17_2 like Mac OS X) FxiOS/120.0",
      "(iPhone; CPU iPhone OS 17_2 like Mac OS X) FxiOS/121.0",
      "Firefox",
    ],
    [
      "(iPhone; CPU iPhone OS 17_2 like Mac OS X) EdgiOS/119.0",
      "(iPhone; CPU iPhone OS 17_2 like Mac OS X) EdgiOS/120.0",
      "Microsoft Edge",
    ],
    [
      "(iPad; CPU OS 17_1 like Mac OS X) Mobile/15E148",
      "(iPad; CPU OS 17_2 like Mac OS X) Mobile/15E148",
      "iOS/iPadOS",
    ],
    [
      "(Macintosh) Version/17.1 Mobile/15E148 Safari/604.1",
      "(Macintosh) Version/17.2 Mobile/15E148 Safari/604.1",
      "iOS/iPadOS",
    ],
    ["Chrome/119.0.0.0 OPR/105.0", "Chrome/120.0.0.0 OPR/106.0", "Opera"],
    [
      "(Android 10) Chrome/117.0.0.0 SamsungBrowser/25.0",
      "(Android 10) Chrome/122.0.0.0 SamsungBrowser/26.0",
      "Samsung Internet",
    ],
    [
      "Chrome/119.0.0.0 coc_coc_browser/125.0",
      "Chrome/120.0.0.0 coc_coc_browser/126.0",
      "Cốc Cốc",
    ],
    [
      "(Android 13; wv) Version/4.0 Chrome/119.0.0.0",
      "(Android 13; wv) Version/4.0 Chrome/120.0.0.0",
      "Android System WebView",
    ],
    ["Chromium/119.0.0.0", "Chromium/120.0.0.0", "Chromium"],
  ]) {
    const result = check(oldAgent)
    assert.equal(result.status, "update", oldAgent)
    assert.equal(result.name, name)
    assert.equal(check(newAgent).status, "allowed", newAgent)
  }
  assert.equal(check("Version/17.10 Safari/605.1.15").status, "allowed")
  assert.equal(
    check("Chrome/64.0.3282.140 Edge/18.19041").name,
    "Microsoft Edge"
  )
  assert.equal(
    check("Mozilla/5.0 Trident/7.0; rv:11.0").name,
    "Internet Explorer"
  )
  assert.equal(
    check(oldChrome, { "sec-ch-ua": '"Brave";v="119", "Chromium";v="119"' })
      .name,
    "Brave"
  )
})

test("unknown clients are blocked and crawler tokens respect known browser versions", () => {
  for (const userAgent of [
    "",
    "curl/8.7.1",
    "SomeBot/2.0",
    "(iPhone) CriOS/120.0.0.0",
  ])
    assert.equal(check(userAgent).status, "unverified", userAgent)
  assert.equal(
    check("Googlebot/2.1 (+http://www.google.com/bot.html)").status,
    "allowed"
  )
  assert.equal(check(`${oldChrome} Googlebot/2.1`).status, "update")
  assert.equal(check(`${reducedChrome} Googlebot/2.1`).status, "allowed")
})

test("the proxy checks application routes and excludes exact public assets", () => {
  const matches = (url) =>
    unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })
  for (const route of [
    "/",
    "/notifications",
    "/chats/room",
    "/shops/shop/products/item?variant=1",
    "/shops/shop/products/example.js",
    "/shops/shop/products/notification-badge.png",
    "/browser-update/another-path",
  ])
    assert.equal(matches(route), true, route)
  for (const route of [
    "/browser-update",
    "/_next/static/chunks/app.js",
    "/_next/image?url=x",
    "/_next/webpack-hmr",
    "/ads.txt",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/favicon.ico",
    "/apple-icon.png",
    "/icon.svg",
    "/notification-worker.js",
    "/notification-badge.png",
    "/notification-icon-192.png",
    "/notification-icon-512.png",
    "/dealhay-logo.svg",
    "/dealhay-home-banner.webp",
    "/dealhay-social.png",
  ])
    assert.equal(matches(route), false, route)
})

test("the proxy serves an update notice for blocked reads and rejects writes", () => {
  const url = "http://localhost:3000/chats/room?message=1"
  const request = (agent, method) =>
    new NextRequest(url, { method, headers: { "user-agent": agent } })

  for (const [agent, method] of [
    [oldSafari, "GET"],
    [oldChrome, "HEAD"],
    ["", "GET"],
  ]) {
    const blocked = proxy(request(agent, method))
    assert.equal(
      getRewrittenUrl(blocked),
      "http://localhost:3000/browser-update"
    )
    assert.equal(blocked.headers.get("cache-control"), "private, no-store")
    assert.equal(blocked.headers.get("critical-ch"), null)
  }

  const blockedPost = proxy(request(oldChrome, "POST"))
  assert.equal(blockedPost.status, 403)
  assert.equal(blockedPost.headers.get("cache-control"), "private, no-store")
  assert.equal(blockedPost.headers.get("x-middleware-next"), null)

  const allowed = proxy(request(reducedChrome, "GET"))
  assert.equal(allowed.headers.get("x-middleware-next"), "1")
  assert.equal(allowed.headers.get("accept-ch"), null)
})
