import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(path, imports = {}) {
  return moduleUrl(
    ts
      .transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
        assert.ok(imports[name], `Unexpected import: ${name}`)
        return `from ${quote}${imports[name]}${quote}`
      })
  )
}
const api = moduleUrl(`
  export class ApiError extends Error {}
  export const requests = []
  export const state = { invalidations: 0, token: "account-a", response: null }
  export const getSessionId = () => state.token
  export const invalidateQueries = () => { state.invalidations++ }
  export async function apiFetch(request) {
    requests.push(request)
    if (state.response) return state.response
    return { message: "Đã lưu tương tác" }
  }
  export const checkoutSchema = {}
`)
const validation = transpile("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const schemas = transpile("../src/modules/public/schemas/reviews.ts", {
  zod: import.meta.resolve("zod"),
  "@/lib/validation": validation,
})
const mutations = transpile("../src/api/catalog/mutations.ts", {
  "@/api/client": api,
  "@/api/catalog/routes": transpile("../src/api/catalog/routes.ts"),
})
const { reactShopAction, reviewProductAction } = await import(
  transpile("../src/modules/public/actions.ts", {
    "@/api/client": api,
    "@/api/catalog/mutations": mutations,
    "@/lib/query-cache": api,
    "@/lib/session": api,
    "@/modules/public/schemas/reviews": schemas,
    "@/modules/public/schemas/checkout": api,
  })
)
const { requests, state } = await import(api)
test.beforeEach(() => {
  requests.length = 0
  state.invalidations = 0
  state.token = "account-a"
  state.response = null
})

test("shop feedback can be set, switched and removed through the API", async () => {
  for (const reaction of ["like", "dislike", null]) {
    await reactShopAction("SHOP-1", reaction)
  }
  assert.deepEqual(
    requests.map((r) => r.method),
    ["PUT", "PUT", "DELETE"]
  )
  assert.ok(requests.every((r) => r.path === "/shops/SHOP-1/reaction"))
  assert.deepEqual(
    requests.slice(0, 2).map((r) => r.body),
    [{ reaction: "like" }, { reaction: "dislike" }]
  )
  assert.equal(state.invalidations, 3)
})

function reviewForm(removeImage = false) {
  const form = new FormData()
  form.set("reaction", "dislike")
  form.set("content", "Đánh giá mẫu dùng để kiểm tra giao diện.")
  form.set("remove_image", removeImage ? "1" : "0")
  return form
}

test("editing a review preserves its existing photo unless removal is explicit", async () => {
  for (const removeImage of [false, true]) {
    const result = await reviewProductAction(
      "shop",
      "product",
      reviewForm(removeImage)
    )
    assert.equal(result.success, true)
    const request = requests.at(-1)
    assert.equal(request.method, "PUT")
    assert.equal(request.body.get("reaction"), "dislike")
    assert.equal(request.body.get("remove_image"), removeImage ? "1" : "0")
    assert.equal(request.body.has("image"), false)
  }
  assert.equal(state.invalidations, 2)
})

test("review replacement uploads forward a permanent image reference", async () => {
  const form = reviewForm()
  const image = "https://media.example.test/reviews/detail.webp"
  form.set("image", image)
  assert.equal(
    (await reviewProductAction("shop", "product", form)).success,
    true
  )
  assert.equal(requests[0].body.get("image"), image)
  assert.equal(requests[0].body.get("remove_image"), "0")
})

test("review actions never use a replacement account for a captured submission", async () => {
  state.token = "account-b"
  const result = await reviewProductAction(
    "shop",
    "product",
    reviewForm(),
    "account-a"
  )
  assert.equal(result.success, false)
  assert.equal(requests.length, 0)
  assert.equal(state.invalidations, 0)
})

test("review requests pin the initiating credential and ignore stale response invalidation", async () => {
  let finish
  state.response = new Promise((resolve) => {
    finish = resolve
  })
  const response = reviewProductAction(
    "shop",
    "product",
    reviewForm(),
    "account-a"
  )
  assert.equal(requests[0].expectedSession, "account-a")
  state.token = "account-b"
  finish({ message: "Đã lưu cho tài khoản ban đầu" })
  assert.equal((await response).success, true)
  assert.equal(state.invalidations, 0)
})
