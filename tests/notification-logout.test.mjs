import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const mocks = moduleUrl(`
  export const authRoutes={logout:"/auth/logout"}
  export function getAccessToken(){return globalThis.__logout.token??"account-a"}
  export const apiFetch=async(options)=>{
    globalThis.__logout.calls.push("api-logout")
    globalThis.__logout.request=options
    return {message:"Đã đăng xuất"}
  }
  export const clearBackgroundNotificationOwner=async()=>{
    globalThis.__logout.calls.push("clear-push")
    await globalThis.__logout.pending
    if(globalThis.__logout.fail)throw new Error("offline")
  }
  export const revokeWssSession=async()=>{
    globalThis.__logout.calls.push("revoke-wss")
    if(globalThis.__logout.fail)throw new Error("offline")
  }
`)
const source = ts.transpileModule(
  readFileSync(
    new URL("../src/api/auth/mutations.ts", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }
).outputText
const { logout } = await import(
  moduleUrl(source.replace(/from (["'])[^"']+\1/g, `from "${mocks}"`))
)

test("logout clears push before revoking credentials used to delete its subscription", async () => {
  let release
  globalThis.__logout = {
    calls: [],
    pending: new Promise((resolve) => {
      release = resolve
    }),
  }
  const request = logout()
  await Promise.resolve()
  assert.deepEqual(globalThis.__logout.calls, ["clear-push"])
  release()
  assert.deepEqual(await request, { message: "Đã đăng xuất" })
  assert.deepEqual(globalThis.__logout.calls, [
    "clear-push",
    "revoke-wss",
    "api-logout",
  ])
  assert.deepEqual(globalThis.__logout.request, {
    method: "POST",
    path: "/auth/logout",
    token: "account-a",
  })
})

test("offline push cleanup and WSS revocation do not prevent API logout", async () => {
  globalThis.__logout = { calls: [], fail: true }
  await logout()
  assert.deepEqual(globalThis.__logout.calls, [
    "clear-push",
    "revoke-wss",
    "api-logout",
  ])
})

test("a slow logout cannot revoke the account signed in from another tab", async () => {
  let release
  globalThis.__logout = {
    calls: [],
    token: "account-a",
    pending: new Promise((resolve) => {
      release = resolve
    }),
  }
  const request = logout()
  globalThis.__logout.token = "account-b"
  release()
  await request
  assert.deepEqual(globalThis.__logout.calls, ["clear-push", "api-logout"])
  assert.equal(globalThis.__logout.request.token, "account-a")
})
