import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
}

function transpileModule(relativePath, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (match, quote, specifier) => {
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}

const validationUrl = transpileModule("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const schemaUrl = transpileModule("../src/modules/chats/schemas/chats.ts", {
  "@/lib/validation": validationUrl,
  zod: import.meta.resolve("zod"),
})
const apiUrl = moduleUrl(`
  export class LiveApiError extends Error {}
  export const sentMessages = []
  export const authQueries = {count:0,session:null}
  export async function sendChatMessage(...args) {
    sentMessages.push(args)
    return { id: "sent-message", attachment: { type: "image" } }
  }
  export function getCurrentSession() {authQueries.count++;if(authQueries.session)return Promise.resolve(authQueries.session);throw new Error("Unexpected auth query") }
  export function markConversationRead() { throw new Error("Unexpected read mutation") }
  export function recordPresenceHeartbeat() { throw new Error("Unexpected heartbeat") }
  export function getChatHistory() { throw new Error("Unexpected history query") }
  export function getChats() { throw new Error("Unexpected chats query") }
`)
const { sendMessageAction, refreshUnreadCountsAction } = await import(
  transpileModule("../src/modules/chats/actions.ts", {
    "@/api/live-client": apiUrl,
    "@/api/chats/browser": apiUrl,
    "@/api/auth/queries": apiUrl,
    "@/modules/chats/schemas/chats": schemaUrl,
  })
)
const { sentMessages, authQueries } = await import(apiUrl)
const { appendOptionalFile, appendOptionalString } = await import(
  transpileModule("../src/lib/form-utils.ts")
)

function compose(body = "", attachment) {
  const formData = new FormData()
  appendOptionalString(formData, "body", body)
  if (typeof attachment === "string") formData.set("attachment", attachment)
  else appendOptionalFile(formData, "attachment", attachment)
  return formData
}

function image() {
  return "https://private-storage.example.test/owner/chat/image.webp"
}

test.beforeEach(() => {
  sentMessages.length = 0
  authQueries.count = 0
  authQueries.session = null
})

test("chat unread refresh uses WSS counts without waiting for a second API session lookup", async () => {
  authQueries.session = {
    user: { id: "user" },
    unreadCounts: { messages: 7, notifications: 0 },
  }
  assert.deepEqual(await refreshUnreadCountsAction(), { messages: 7 })
  assert.equal(authQueries.count, 1)
})

test("message retries preserve a caller-owned UUID and reject invalid identifiers", async () => {
  const form = compose("Retry this message")
  const id = "c7e3a481-a449-4e10-b4dd-9109d2205599"
  form.set("client_message_id", id)
  await sendMessageAction("test-conversation", form)
  await sendMessageAction("test-conversation", form)
  assert.equal(sentMessages[0][2], id)
  assert.equal(sentMessages[1][2], id)
  const invalid = compose("Invalid identifier")
  invalid.set("client_message_id", "forged-value")
  assert.equal(
    (await sendMessageAction("test-conversation", invalid)).success,
    false
  )
  assert.equal(sentMessages.length, 2)
})

test("an image without a caption is sent when the composer omits the body field", async () => {
  const attachment = image()
  const formData = compose("", attachment)
  assert.equal(formData.get("body"), null)

  const state = await sendMessageAction("test-conversation", formData)

  assert.equal(state.success, true)
  assert.equal(state.data.id, "sent-message")
  assert.equal(sentMessages.length, 1)
  const [slug, payload, idempotencyKey] = sentMessages[0]
  assert.equal(slug, "test-conversation")
  assert.equal(payload.has("body"), false)
  assert.equal(payload.get("attachment"), attachment)
  assert.match(idempotencyKey, /^[0-9a-f-]{36}$/)
  assert.equal(payload.get("client_message_id"), idempotencyKey)
})

test("an image URL with a caption preserves its reference and socket metadata", async () => {
  const attachment = image()
  const formData = compose("  Ảnh sản phẩm  ", attachment)
  formData.set("socket_id", "socket_ABCD-1234")

  const state = await sendMessageAction("test-conversation", formData)

  assert.equal(state.success, true)
  assert.equal(sentMessages.length, 1)
  const [, payload, , socketId] = sentMessages[0]
  assert.equal(payload.get("body"), "Ảnh sản phẩm")
  assert.equal(payload.get("attachment"), attachment)
  assert.equal(socketId, "socket_ABCD-1234")
})

test("a supported document without a caption is also sent", async () => {
  const attachment = new File(["Document"], "document.txt", {
    type: "text/plain",
  })

  const state = await sendMessageAction(
    "test-conversation",
    compose("", attachment)
  )

  assert.equal(state.success, true)
  assert.equal(sentMessages.length, 1)
  assert.equal(sentMessages[0][1].get("attachment"), attachment)
})

test("a text message without an attachment still sends", async () => {
  const state = await sendMessageAction(
    "test-conversation",
    compose("Xin chào")
  )

  assert.equal(state.success, true)
  assert.equal(sentMessages.length, 1)
  assert.equal(sentMessages[0][1].get("body"), "Xin chào")
  assert.equal(sentMessages[0][1].has("attachment"), false)
  assert.equal(sentMessages[0][1].has("reply_to_id"), false)
})

test("system Unicode emoji can be sent without other text or an attachment", async () => {
  const emoji = "👋🏽 👨‍👩‍👧‍👦 🇻🇳 ✨"

  const state = await sendMessageAction("test-conversation", compose(emoji))

  assert.equal(state.success, true)
  assert.equal(sentMessages[0][1].get("body"), emoji)
})

test("a text reply forwards only the original message identifier with its content", async () => {
  const replyId = "c7e3a481-a449-4e10-b4dd-9109d2205599"
  const formData = compose("Dạ được 👍")
  formData.set("reply_to_id", replyId)
  formData.set("reply_to", JSON.stringify({ body: "Untrusted quoted content" }))

  const state = await sendMessageAction("test-conversation", formData)

  assert.equal(state.success, true)
  assert.equal(sentMessages[0][1].get("reply_to_id"), replyId)
  assert.equal(sentMessages[0][1].get("body"), "Dạ được 👍")
  assert.equal(sentMessages[0][1].has("reply_to"), false)
})

test("an image-only reply keeps its original target and attachment", async () => {
  const replyId = "c7e3a481-a449-4e10-b4dd-9109d2205599"
  const attachment = image()
  const formData = compose("", attachment)
  formData.set("reply_to_id", replyId)

  const state = await sendMessageAction("test-conversation", formData)

  assert.equal(state.success, true)
  assert.equal(sentMessages[0][1].get("reply_to_id"), replyId)
  assert.equal(sentMessages[0][1].get("attachment"), attachment)
  assert.equal(sentMessages[0][1].has("body"), false)
})

test("invalid reply identifiers are rejected before contacting the API", async () => {
  for (const replyId of [
    "not-a-message-id",
    "   ",
    new File(["message-id"], "message.txt", { type: "text/plain" }),
  ]) {
    const formData = compose("A reply")
    formData.set("reply_to_id", replyId)

    const state = await sendMessageAction("test-conversation", formData)

    assert.equal(state.success, false)
    assert.ok(state.errors.reply_to_id.length)
  }
  assert.equal(sentMessages.length, 0)
})

test("selecting a reply target alone does not create an empty message", async () => {
  const formData = compose()
  formData.set("reply_to_id", "c7e3a481-a449-4e10-b4dd-9109d2205599")

  const state = await sendMessageAction("test-conversation", formData)

  assert.equal(state.success, false)
  assert.ok(state.errors.body.length)
  assert.equal(sentMessages.length, 0)
})

test("missing or whitespace-only body without an attachment is rejected", async () => {
  for (const body of ["", "   "]) {
    const state = await sendMessageAction("test-conversation", compose(body))

    assert.equal(state.success, false)
    assert.equal(
      state.errors.body[0],
      "Vui lòng nhập nội dung hoặc chọn tệp đính kèm."
    )
  }
  assert.equal(sentMessages.length, 0)
})

test("a file supplied as message text remains invalid", async () => {
  const formData = compose("", image())
  formData.set("body", new File(["text"], "body.txt", { type: "text/plain" }))

  const state = await sendMessageAction("test-conversation", formData)

  assert.equal(state.success, false)
  assert.ok(state.errors.body.length)
  assert.equal(sentMessages.length, 0)
})

test("original image files are rejected before the chat API", async () => {
  for (const attachment of [
    new File(["raw"], "source.png", { type: "image/png" }),
    new File(["raw"], "source.jpg", { type: "image/jpeg" }),
  ]) {
    const state = await sendMessageAction(
      "test-conversation",
      compose("", attachment)
    )
    assert.equal(state.success, false)
  }
  assert.equal(sentMessages.length, 0)
})
test("oversized images are rejected before contacting the chat API", async () => {
  const attachment = new File(
    [new Uint8Array(10 * 1024 * 1024 + 1)],
    "large.jpg",
    { type: "image/jpeg" }
  )
  const state = await sendMessageAction(
    "test-conversation",
    compose("", attachment)
  )
  assert.equal(state.success, false)
  assert.ok(state.errors.attachment.length)
  assert.equal(sentMessages.length, 0)
})

test("admin tags can invite help without a caption and preserve selected admin identities", async () => {
  const formData = compose()
  formData.append("mention_admin_ids", "admin-1")
  formData.append("mention_admin_ids", "admin-2")
  const state = await sendMessageAction("test-conversation", formData)
  assert.equal(state.success, true)
  assert.deepEqual(sentMessages[0][1].getAll("mention_admin_ids"), [
    "admin-1",
    "admin-2",
  ])
})

test("the composer accepts fifty images in one selection and rejects selections over fifty", async () => {
  const { sendMessageSchema } = await import(schemaUrl)
  const attachments = Array.from(
    { length: 50 },
    (_, index) =>
      new File([`image-${index}`], `${index}.png`, { type: "image/png" })
  )
  assert.equal(
    sendMessageSchema.safeParse({
      body: "",
      attachments,
      mention_admin_ids: [],
    }).success,
    true
  )
  assert.equal(
    sendMessageSchema.safeParse({
      body: "",
      attachments: [...attachments, attachments[0]],
      mention_admin_ids: [],
    }).success,
    false
  )
})
