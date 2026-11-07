import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const source = readFileSync(
  new URL("../src/lib/public-media-url.ts", import.meta.url),
  "utf8"
)
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
const { isPublicMediaAssetUrl, publicMediaRemotePattern } = await import(
  moduleUrl
)

test("public media remote pattern is restricted to the configured API path", () => {
  assert.deepEqual(publicMediaRemotePattern("https://api.example.test/api/"), {
    protocol: "https",
    hostname: "api.example.test",
    port: "",
    pathname: "/api/media/assets/**",
    search: "",
  })
  assert.deepEqual(publicMediaRemotePattern("http://127.0.0.1:8000/api"), {
    protocol: "http",
    hostname: "127.0.0.1",
    port: "8000",
    pathname: "/api/media/assets/**",
    search: "",
  })
  assert.equal(publicMediaRemotePattern("javascript:alert(1)"), null)
  assert.equal(publicMediaRemotePattern("https://api.test/api?unsafe=1"), null)
})

test("only exact query-free public API asset URLs are optimizable", () => {
  const apiUrl = "https://api.example.test/api"
  const accepted = [
    "https://api.example.test/api/media/assets/product/photo.webp",
    "https://API.EXAMPLE.TEST/api/media/assets/product/encoded%20name.webp",
  ]
  const rejected = [
    "https://api.example.test/api/media/assets/",
    "https://api.example.test/api/media/assets-extra/photo.webp",
    "https://api.example.test/api/private/photo.webp",
    "https://api.example.test/api/media/assets/photo.webp?v=1",
    "https://api.example.test/api/media/assets/photo.webp#fragment",
    "https://user@api.example.test/api/media/assets/photo.webp",
    "https://other.example.test/api/media/assets/photo.webp",
    "/api/media/assets/photo.webp",
    "blob:https://api.example.test/preview",
  ]

  for (const value of accepted) {
    assert.equal(isPublicMediaAssetUrl(value, apiUrl), true, value)
  }
  for (const value of rejected) {
    assert.equal(isPublicMediaAssetUrl(value, apiUrl), false, value)
  }
})
