import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const source = ts.transpileModule(
  readFileSync(
    new URL("../src/modules/chats/lib/chat-send-attempt.ts", import.meta.url),
    "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText
const { chatSendAttempt, prepareChatSendAttempt } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
)

test("an unchanged draft keeps its identifier until confirmed success or an actual payload change", () => {
  const attachment = new File(["image"], "image.webp", { type: "image/webp" })
  const draft = {
    conversationSlug: "shop-customer",
    body: " Hello ",
    attachment,
    replyToId: "reply-id",
  }
  const attempt = chatSendAttempt(null, draft)
  assert.equal(chatSendAttempt(attempt, { ...draft, body: "Hello" }), attempt)
  assert.match(attempt.clientMessageId, /^[0-9a-f-]{36}$/)
  for (const mutation of [
    { body: "Another message" },
    { replyToId: "another-reply" },
    { conversationSlug: "another-chat" },
    { attachment: undefined },
    { attachment: new File(["image"], "image.webp", { type: "image/webp" }) },
  ])
    assert.notEqual(
      chatSendAttempt(attempt, { ...draft, ...mutation }).clientMessageId,
      attempt.clientMessageId
    )
  assert.notEqual(
    chatSendAttempt(null, draft).clientMessageId,
    attempt.clientMessageId
  )
})

test("concurrent preparations share one upload and reuse its reference on retries", async () => {
  const attempt = chatSendAttempt(null, {
    conversationSlug: "shop-customer",
    body: "",
    attachment: new File(["image"], "image.webp"),
  })
  let uploads = 0
  const prepare = async (payload) => {
    uploads++
    payload.set(
      "attachment",
      "https://wss.example.test/chat-uploads/assets/immutable-reference"
    )
    return payload
  }
  const [first, second] = await Promise.all([
    prepareChatSendAttempt(attempt, prepare),
    prepareChatSendAttempt(attempt, prepare),
  ])
  assert.equal(uploads, 1)
  assert.equal(first, second)
  assert.equal(first.get("client_message_id"), attempt.clientMessageId)
  assert.equal(await prepareChatSendAttempt(attempt, prepare), first)
  assert.equal(uploads, 1)
})

test("a persisted message with a lost response retries the same id and attachment instead of creating a duplicate", async () => {
  const draft = {
    conversationSlug: "shop-customer",
    body: "Attachment",
    attachment: new File(["file"], "note.txt"),
  }
  const first = chatSendAttempt(null, draft)
  let uploads = 0
  const prepare = async (payload) => {
    payload.set(
      "attachment",
      `https://wss.example.test/chat-uploads/assets/reference-${++uploads}`
    )
    return payload
  }
  const records = new Map()
  const send = (payload, loseResponse) => {
    const key = payload.get("client_message_id"),
      value = Object.fromEntries(payload)
    if (records.has(key)) assert.deepEqual(records.get(key), value)
    else records.set(key, value)
    if (loseResponse) throw new Error("Response lost after SQLite committed")
    return records.get(key)
  }
  const original = await prepareChatSendAttempt(first, prepare)
  assert.throws(() => send(original, true), /Response lost/)
  const retry = chatSendAttempt(first, draft)
  const payload = await prepareChatSendAttempt(retry, prepare)
  send(payload, false)
  assert.equal(records.size, 1)
  assert.equal(uploads, 1)
  assert.equal(payload.get("attachment"), original.get("attachment"))
})

test("failed upload preparation is retried without changing the message identity", async () => {
  const attempt = chatSendAttempt(null, {
    conversationSlug: "shop-customer",
    body: "Hello",
  })
  await assert.rejects(
    prepareChatSendAttempt(attempt, async () => {
      throw new Error("R2 unavailable")
    }),
    /R2 unavailable/
  )
  const retried = await prepareChatSendAttempt(
    attempt,
    async (payload) => payload
  )
  assert.equal(retried.get("client_message_id"), attempt.clientMessageId)
})
