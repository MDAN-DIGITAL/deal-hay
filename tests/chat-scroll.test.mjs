import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
const source = ts.transpileModule(
  readFileSync(
    new URL("../src/modules/chats/lib/chat-scroll.ts", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText
const { initialChatMessageStart, chatMessageStartForTarget } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
)

test("long preloaded conversations initially mount the latest 150 messages", () => {
  const messages = Array.from({ length: 10000 }, (_, index) => ({
    id: String(index),
  }))
  assert.equal(initialChatMessageStart(messages), "9850")
})

test("toast targets reveal old preloaded messages without resetting an already expanded history window", () => {
  const messages = Array.from({ length: 10000 }, (_, index) => ({
    id: String(index),
  }))
  assert.equal(chatMessageStartForTarget(messages, "50", "9850"), "40")
  assert.equal(chatMessageStartForTarget(messages, "5", "9850"), "0")
  assert.equal(chatMessageStartForTarget(messages, "9990", "9300"), "9300")
  assert.equal(chatMessageStartForTarget(messages, "missing", "9300"), "9300")
})

test("changing people retains the expanded history window needed to restore their scroll position", () => {
  const messages = Array.from({ length: 10000 }, (_, index) => ({
    id: String(index),
  }))
  assert.equal(
    initialChatMessageStart(messages, {
      firstRenderedMessageId: "9300",
      scrollTop: 123,
      atBottom: false,
    }),
    "9300"
  )
  assert.equal(
    initialChatMessageStart(messages, {
      firstRenderedMessageId: "removed",
      scrollTop: 123,
      atBottom: false,
    }),
    "9850"
  )
})
