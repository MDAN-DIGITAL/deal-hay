import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import ts from "typescript"

import {
  browserSupport,
  FULL_BROWSER_VERSION_HINT,
} from "../src/lib/browser-support.ts"

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

const reducedChrome = "Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36"
const oldSafari = "Mozilla/5.0 (Macintosh) Version/15.6.1 Safari/605.1.15"

test("Chrome compares all four version components at the requested cutoff", () => {
  for (const version of ["127.0.6613.999", "128.0.6613.99", "128.0.6613.137"])
    assert.equal(check(`Chrome/${version}`).status, "update", version)
  for (const version of [
    "128.0.6613.138",
    "128.0.6613.139",
    "128.0.6614.1",
    "129.0.0.0",
  ])
    assert.equal(check(`Chrome/${version}`).status, "allowed", version)
})

test("a reduced Chrome 128 User-Agent requires its full-version hint", () => {
  assert.equal(check(reducedChrome).status, "unverified")
  for (const version of ["127.0.6613.138", "128.0.0.0"]) {
    assert.equal(
      check(reducedChrome, {
        [FULL_BROWSER_VERSION_HINT]: `"Google Chrome";v="${version}"`,
      }).status,
      "unverified"
    )
  }
  for (const [patch, expected] of [
    [137, "update"],
    [138, "allowed"],
  ]) {
    assert.equal(
      check(reducedChrome, {
        [FULL_BROWSER_VERSION_HINT]: `"Chromium";v="128.0.6613.${patch}", "Google Chrome";v="128.0.6613.${patch}"`,
      }).status,
      expected
    )
  }
})

test("equivalent browsers use their own releases or engine versions", () => {
  for (const [oldAgent, newAgent, name] of [
    [
      "Chrome/127.0.0.0 Edg/127.0.0.0",
      "Chrome/128.0.0.0 Edg/128.0.0.0",
      "Microsoft Edge",
    ],
    ["Firefox/129.0", "Firefox/130.0", "Firefox"],
    [oldSafari, "Version/18.0 Safari/605.1.15", "Safari"],
    [
      "(iPhone; CPU iPhone OS 17_6 like Mac OS X) CriOS/130.0.0.0",
      "(iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/128.0.0.0",
      "iOS/iPadOS",
    ],
    ["Chrome/127.0.0.0 OPR/113.0", "Chrome/128.0.0.0 OPR/114.0", "Opera"],
    [
      "(Android 13; wv) Version/4.0 Chrome/127.0.0.0",
      "(Android 13; wv) Version/4.0 Chrome/128.0.0.0",
      "Android System WebView",
    ],
  ]) {
    const result = check(oldAgent)
    assert.equal(result.status, "update", oldAgent)
    assert.equal(result.name, name)
    assert.equal(check(newAgent).status, "allowed", newAgent)
  }
  assert.equal(
    check("Chrome/64.0.3282.140 Edge/18.19041").name,
    "Microsoft Edge"
  )
  assert.equal(
    check(reducedChrome, { "sec-ch-ua": '"Brave";v="128", "Chromium";v="128"' })
      .status,
    "allowed"
  )
  assert.equal(check("Chrome/125.0.0.0 Googlebot/2.1").status, "allowed")
  assert.equal(check("curl/8.7.1").status, "allowed")
})

test("the proxy replaces application routes and allows the assets needed by the update screen", () => {
  const matches = (url) =>
    unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })
  for (const route of [
    "/",
    "/notifications",
    "/chats/room",
    "/shops/shop/products/item?variant=1",
  ])
    assert.equal(matches(route), true, route)
  for (const route of [
    "/browser-update",
    "/_next/static/chunks/app.js",
    "/_next/image?url=x",
    "/api/test",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/notification-worker.js",
    "/dealhay-logo.svg",
  ])
    assert.equal(matches(route), false, route)

  const url = "http://localhost:3000/chats/room?message=1"
  const request = (agent, extra) =>
    new NextRequest(url, {
      headers: { "user-agent": agent, ...extra },
    })
  const blocked = proxy(request(oldSafari))
  assert.equal(getRewrittenUrl(blocked), "http://localhost:3000/browser-update")
  assert.equal(blocked.headers.get("cache-control"), "private, no-store")
  const unverified = proxy(request(reducedChrome))
  assert.equal(unverified.headers.get("accept-ch"), FULL_BROWSER_VERSION_HINT)
  assert.equal(unverified.headers.get("critical-ch"), FULL_BROWSER_VERSION_HINT)
  const allowed = proxy(
    request(reducedChrome, {
      [FULL_BROWSER_VERSION_HINT]: '"Google Chrome";v="128.0.6613.138"',
    })
  )
  assert.equal(allowed.headers.get("x-middleware-next"), "1")
  assert.equal(allowed.headers.get("accept-ch"), FULL_BROWSER_VERSION_HINT)
})
