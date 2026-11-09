import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function load(path, imports = {}) {
  return moduleUrl(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
    assert.ok(imports[name], `Unexpected import: ${name}`)
    return `from ${quote}${imports[name]}${quote}`
  }))
}
const transport = moduleUrl(`
  export const state = { calls: [], beforeReply: null }
  export async function wssFetch(options, isCurrent) {
    if (isCurrent && !isCurrent()) throw new Error('Phiên đăng nhập đã thay đổi.')
    state.calls.push(options)
    state.beforeReply?.()
    return { uploads: [{ token: 'staged-file', url: 'https://storage.test/file?signature=old-owner',
      asset_url: 'https://storage.test/file', headers: { 'Content-Type': 'application/pdf' } }] }
  }
`)
const { state } = await import(transport)
const { uploadChatFile } = await import(load("../src/lib/chat-upload.ts", {
  zod: import.meta.resolve("zod"),
  "@/api/wss-client": transport,
  "@/lib/storage-upload": load("../src/lib/storage-upload.ts"),
}))
const file = () => new File(["private attachment"], "document.pdf", { type: "application/pdf" })
test.beforeEach(() => { state.calls = []; state.beforeReply = null })

test("changing accounts while reserving a chat file prevents its PUT and cleanup with the new credentials", async (t) => {
  let current = true
  state.beforeReply = () => { current = false }
  t.mock.method(globalThis, "fetch", async () => assert.fail("The obsolete file must not upload"))
  await assert.rejects(uploadChatFile(file(), () => current), /Phiên đăng nhập đã thay đổi/)
  assert.deepEqual(state.calls.map((call) => call.method), ["POST"])
})

test("changing accounts during a PUT never returns an attachment reference to the new session", async (t) => {
  let current = true
  t.mock.method(globalThis, "fetch", async () => {
    current = false
    return new Response(null, { status: 200 })
  })
  await assert.rejects(uploadChatFile(file(), () => current), /Phiên đăng nhập đã thay đổi/)
  assert.deepEqual(state.calls.map((call) => call.method), ["POST"])
})

test("an ordinary failed chat file PUT still releases the original account's reservation", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }))
  await assert.rejects(uploadChatFile(file(), () => true), /Không thể tải tệp/)
  assert.deepEqual(state.calls.map((call) => call.method), ["POST", "DELETE"])
  assert.deepEqual(state.calls[1].body, { tokens: ["staged-file"] })
})
