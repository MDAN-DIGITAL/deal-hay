import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const source = ts.transpileModule(
  readFileSync(
    new URL(
      "../src/modules/chats/lib/chat-attachment-cache.ts",
      import.meta.url
    ),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText
const { createChatAttachmentCache } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
)

test("preload and repeated visits share one protected image request and object URL", async () => {
  let calls = 0
  const revoked = []
  const cache = createChatAttachmentCache(
    async () => {
      calls++
      return new Blob(["image"])
    },
    {
      createObjectURL: () => "blob:cached-image",
      revokeObjectURL: (url) => revoked.push(url),
    }
  )
  const first = cache.get("image-id")
  const second = cache.get("image-id")
  assert.equal(first, second)
  const result = await first
  assert.equal(result.url, "blob:cached-image")
  assert.equal((await cache.get("image-id")).url, result.url)
  assert.equal(calls, 1)
  assert.equal(cache.peek("image-id"), result)
  cache.clear()
  assert.deepEqual(revoked, ["blob:cached-image"])
})

test("failed image requests can be retried and leaving chat aborts pending downloads", async () => {
  let calls = 0
  let signal
  const cache = createChatAttachmentCache(
    async (_id, currentSignal) => {
      signal = currentSignal
      if (++calls === 1) throw new Error("Temporary outage")
      return new Blob(["image"])
    },
    { createObjectURL: () => "blob:retry", revokeObjectURL: () => {} }
  )
  await assert.rejects(cache.get("image-id"), /Temporary outage/)
  await cache.get("image-id")
  assert.equal(calls, 2)
  cache.clear()
  assert.equal(signal.aborted, true)
})
