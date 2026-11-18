import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(path, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
      assert.ok(imports[name], `Unexpected import ${name}`)
      return `from ${quote}${imports[name]}${quote}`
    })
  )
}
const validation = transpile("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const schemas = transpile("../src/modules/auth/schemas/auth.ts", {
  zod: import.meta.resolve("zod"),
  "@/lib/validation": validation,
})
const mocks = moduleUrl(`
  export const state={account:null,requests:[],sessions:[],response:null,error:null,wait:null}
  export class ApiError extends Error { constructor(status,errors){super('Không thể đặt lại mật khẩu.');this.status=status;this.errors=errors} }
  export function getSessionId(){return state.account}
  export async function resetPassword(payload){state.requests.push(payload);await state.wait;if(state.error)throw state.error;return state.response}
  export async function setAuthSession(id){state.sessions.push(id);state.account=id}
  export function clearAuthSession(){}
  export function login(){};export function register(){};export function forgotPassword(){};export function logout(){}
`)
const { state, ApiError } = await import(mocks)
const { resetPasswordAction } = await import(
  transpile("../src/modules/auth/actions.ts", {
    "@/api/client": mocks,
    "@/api/auth/mutations": mocks,
    "@/lib/auth": mocks,
    "@/lib/session": mocks,
    "@/lib/auth-redirect": transpile("../src/lib/auth-redirect.ts"),
    "@/modules/auth/schemas/auth": schemas,
  })
)
const { readResetPasswordLink } = await import(
  transpile("../src/modules/auth/lib/reset-password-link.ts")
)
const values = {
  email: "customer@example.test",
  token: "reset-secret",
  password: "NewPassword123",
  password_confirmation: "NewPassword123",
}
let destinations

test.beforeEach(() => {
  destinations = []
  globalThis.window = {
    location: { replace: (href) => destinations.push(href) },
  }
  Object.assign(state, {
    account: null,
    requests: [],
    sessions: [],
    response: {
      message: "Đặt lại mật khẩu thành công.",
      session: "new-session",
      user: { id: "customer", is_active: true },
    },
    error: null,
    wait: null,
  })
})

test("a successful reset saves a temporary session and replaces the reset page", async () => {
  const result = await resetPasswordAction(values)
  assert.equal(result.authenticated, true)
  assert.equal(state.account, "new-session")
  assert.deepEqual(state.requests, [values])
  assert.deepEqual(state.sessions, [state.response.session])
  assert.deepEqual(destinations, ["/"])
})

test("expired reset links expose an actionable error without creating a session", async () => {
  state.error = new ApiError(422, {
    token: ["Liên kết đã hết hạn. Vui lòng yêu cầu liên kết mới."],
  })
  const result = await resetPasswordAction(values)
  assert.equal(result.success, false)
  assert.deepEqual(result.errors, state.error.errors)
  assert.deepEqual(state.sessions, [])
  assert.deepEqual(destinations, [])
})

test("local validation rejects an invalid password without submitting the reset secret", async () => {
  const result = await resetPasswordAction({ ...values, password: "short" })
  assert.equal(result.success, false)
  assert.deepEqual(state.requests, [])
  assert.deepEqual(state.sessions, [])
})

test("a locked account can finish the reset without receiving an authenticated session", async () => {
  state.response = {
    message: "Mật khẩu đã đổi. Tài khoản vẫn bị khóa.",
    session: null,
    user: { id: "customer", is_active: false },
  }
  const result = await resetPasswordAction(values)
  assert.equal(result.success, true)
  assert.equal(result.authenticated, false)
  assert.equal(result.message, state.response.message)
  assert.deepEqual(state.sessions, [])
  assert.deepEqual(destinations, [])
})

test("a delayed reset cannot overwrite a different account selected while waiting", async () => {
  state.account = "old-account"
  let finish
  state.wait = new Promise((resolve) => {
    finish = resolve
  })
  const pending = resetPasswordAction(values)
  state.account = "other-account"
  finish()
  const result = await pending
  assert.equal(result.success, true)
  assert.equal(state.account, "other-account")
  assert.deepEqual(state.sessions, [])
  assert.deepEqual(destinations, [])
})

test("capturing a reset link removes the credential from the address while retaining it in memory", () => {
  const captured = readResetPasswordLink(
    "https://dealhay.example/reset-password?token=reset%2Bsecret&email=an%2Btag%40example.test&redirect=%2Fprofile#security"
  )
  assert.equal(captured.token, "reset+secret")
  assert.equal(captured.email, "an+tag@example.test")
  assert.equal(
    captured.cleanHref,
    "/reset-password?email=an%2Btag%40example.test&redirect=%2Fprofile#security"
  )
  assert.ok(!captured.cleanHref.includes("secret"))
})

test("fragment reset links are captured and scrubbed too", () => {
  const captured = readResetPasswordLink(
    "https://dealhay.example/reset-password#token=secret&email=an%40example.test"
  )
  assert.equal(captured.token, "secret")
  assert.equal(captured.email, "an@example.test")
  assert.equal(captured.cleanHref, "/reset-password#email=an%40example.test")
})

test("ambiguous or missing reset credentials never produce a usable reset link", () => {
  for (const href of [
    "?email=an@example.test",
    "?token=",
    "?token=one&token=two",
    "?token=one#token=two",
  ]) {
    const captured = readResetPasswordLink(
      `https://dealhay.example/reset-password${href}`
    )
    assert.equal(captured.token, undefined)
    assert.ok(!captured.cleanHref.includes("token="))
  }
})
