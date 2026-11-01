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
const { chatSendAttempt, prepareChatSendAttempt, chatSendAttempts } =
  await import(
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

test("multiple photos keep separate identifiers and a partially sent batch resumes only unsent photos", async () => {
  const files = [
    new File(["a"], "a.webp"),
    new File(["b"], "b.webp"),
    new File(["c"], "c.webp"),
  ]
  const draft = {
    conversationSlug: "thread",
    body: "Caption",
    attachments: files,
    replyToId: "original",
    mentionAdminIds: ["admin"],
  }
  const attempts = chatSendAttempts([], draft)
  assert.equal(
    new Set(attempts.map(({ clientMessageId }) => clientMessageId)).size,
    3
  )
  assert.equal(attempts[0].body, "Caption")
  assert.deepEqual(attempts[0].mentionAdminIds, ["admin"])
  assert.equal(attempts[0].replyToId, "original")
  assert.equal(attempts[1].body, "")
  assert.equal(attempts[1].replyToId, undefined)
  assert.deepEqual(attempts[1].mentionAdminIds, [])
  const resumed = chatSendAttempts(attempts.slice(1), {
    conversationSlug: "thread",
    body: "",
    attachments: files.slice(1),
    mentionAdminIds: [],
  })
  assert.equal(resumed[0], attempts[1])
  assert.equal(resumed[1], attempts[2])
  const payload = await prepareChatSendAttempt(
    attempts[0],
    async (form) => form
  )
  assert.deepEqual(payload.getAll("mention_admin_ids"), ["admin"])
})

test("changing only the tagged admin creates a new idempotency identity", () => {
  const draft = {
    conversationSlug: "thread",
    body: "Help",
    mentionAdminIds: ["first-admin"],
  }
  const first = chatSendAttempt(null, draft)
  const second = chatSendAttempt(first, {
    ...draft,
    mentionAdminIds: ["second-admin"],
  })
  assert.notEqual(first.clientMessageId, second.clientMessageId)
})

test("a fifty-photo selection prepares fifty distinct stable attempts without losing captions or admin tags", async () => {
  const files = Array.from(
    { length: 50 },
    (_, index) =>
      new File([`image-${index}`], `${index}.webp`, { type: "image/webp" })
  )
  const draft = {
    conversationSlug: "thread",
    body: "50 ảnh",
    attachments: files,
    mentionAdminIds: ["admin"],
  }
  const first = chatSendAttempts([], draft)
  const retry = chatSendAttempts(first, draft)
  assert.equal(first.length, 50)
  assert.equal(
    new Set(first.map(({ clientMessageId }) => clientMessageId)).size,
    50
  )
  assert.ok(retry.every((attempt, index) => attempt === first[index]))
  assert.equal(first.filter(({ body }) => body).length, 1)
  assert.equal(
    first.filter(({ mentionAdminIds }) => mentionAdminIds.length).length,
    1
  )
  let preparedFiles = 0
  for (const attempt of first) {
    await prepareChatSendAttempt(attempt, async (payload) => {
      assert.equal(payload.getAll("attachment").length, 1)
      assert.equal(payload.get("attachment"), files[preparedFiles++])
      return payload
    })
  }
  assert.equal(preparedFiles, 50)
})
