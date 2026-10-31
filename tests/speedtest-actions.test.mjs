import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(path, imports) {
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
    outputText.replace(/from (["'])([^"']+)\1/g, (_match, quote, specifier) => {
      assert.ok(imports[specifier], `Unmocked import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}
const mocks = moduleUrl(`
  export const state = { token: null, calls: [], response: null, error: null, beforeReject: null }
  export class ApiError extends Error { constructor(status, message) { super(message); this.status = status } }
  export function getAccessToken() { state.calls.push({cookie:"dealhay_access_token"}); return state.token }
  export async function clearAuthSession() { state.calls.push({clearAuthSession:true}); state.token=null }
  export async function apiFetch(options) { state.calls.push(options); if(state.error) { state.beforeReject?.(); throw state.error } return state.response }
  export const env = { API_URL: "https://api.example.test/api" }
`)
const { state, ApiError } = await import(mocks)
const { startSpeedtestAction } = await import(
  transpile("../src/modules/diagnostics/speedtest-actions.ts", {
    "@/lib/session": mocks,
    "@/api/client": mocks,
    "@/config/env": mocks,
    "@/lib/auth": mocks,
    "@/lib/auth-redirect": transpile("../src/lib/auth-redirect.ts", {}),
    "@/modules/diagnostics/lib/speedtest": transpile(
      "../src/modules/diagnostics/lib/speedtest.ts",
      { "@/config/env": mocks }
    ),
    zod: import.meta.resolve("zod"),
  })
)
test.beforeEach(() => {
  globalThis.window = {
    location: {
      assign(href) {
        const error = new Error("NEXT_REDIRECT")
        error.href = href
        throw error
      },
    },
  }
  state.token = "123|private-account-token"
  state.calls = []
  state.error = null
  state.beforeReject = null
  state.response = {
    token: "g".repeat(64),
    expires_at: "2026-10-24T10:00:00+00:00",
    endpoint_path: "/diagnostics/speedtest",
    limits: {
      max_download_bytes: 4194304,
      max_upload_bytes: 2097152,
      max_session_bytes: 67108864,
      max_requests: 64,
    },
  }
})

test("exchanges the private account token for a scoped grant without a second profile request", async () => {
  const result = await startSpeedtestAction()
  assert.deepEqual(state.calls, [
    { cookie: "dealhay_access_token" },
    {
      method: "POST",
      path: "/diagnostics/speedtest/session",
      body: { target: "backend" },
      token: state.token,
    },
  ])
  assert.deepEqual(result, {
    success: true,
    data: {
      target: "backend",
      token: state.response.token,
      endpointUrl: "https://api.example.test/api/diagnostics/speedtest",
      expiresAt: state.response.expires_at,
      limits: state.response.limits,
    },
  })
  assert.ok(!JSON.stringify(result).includes(state.token))
  assert.ok(result.data.endpointUrl.startsWith("https://api.example.test/"))
})

test("exchanges a separate WSS grant and probes only its validated public endpoint", async () => {
  state.response = {
    ...state.response,
    target: "wss",
    endpoint_url: "https://wss.example.test/diagnostics/speedtest",
  }
  const result = await startSpeedtestAction("wss")
  assert.deepEqual(state.calls, [
    { cookie: "dealhay_access_token" },
    {
      method: "POST",
      path: "/diagnostics/speedtest/session",
      body: { target: "wss" },
      token: state.token,
    },
  ])
  assert.equal(result.success, true)
  assert.equal(result.data.target, "wss")
  assert.equal(result.data.token, state.response.token)
  assert.equal(result.data.endpointUrl, state.response.endpoint_url)
  assert.ok(!JSON.stringify(result).includes(state.token))
})

test("allows local HTTP WSS probes without requiring a frontend WSS environment variable", async () => {
  for (const origin of [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://[::1]:8080",
  ]) {
    state.response = {
      ...state.response,
      target: "wss",
      endpoint_url: `${origin}/diagnostics/speedtest`,
    }
    const result = await startSpeedtestAction("wss")
    assert.equal(result.success, true)
    assert.equal(result.data.endpointUrl, state.response.endpoint_url)
  }
})

test("rejects WSS grants with unsafe URLs, unexpected target identities or missing endpoints", async () => {
  const original = {
    ...state.response,
    target: "wss",
    endpoint_url: "https://wss.example.test/diagnostics/speedtest",
  }
  for (const mutation of [
    { target: undefined },
    { target: "backend" },
    { target: "unknown" },
    { endpoint_url: undefined },
    { endpoint_url: "http://wss.example.test/diagnostics/speedtest" },
    { endpoint_url: "wss://wss.example.test/diagnostics/speedtest" },
    {
      endpoint_url:
        "https://user:secret@wss.example.test/diagnostics/speedtest",
    },
    {
      endpoint_url:
        "https://wss.example.test/diagnostics/speedtest?token=secret",
    },
    { endpoint_url: "https://wss.example.test/diagnostics/speedtest#probe" },
    { endpoint_url: "https://wss.example.test/diagnostics/speedtest?" },
    { endpoint_url: "https://wss.example.test/diagnostics/speedtest#" },
    { endpoint_url: "https://wss.example.test/internal/events" },
    { endpoint_url: "https://wss.example.test/diagnostics/speedtest/" },
    { token: state.token },
  ]) {
    state.response = { ...original, ...mutation }
    const result = await startSpeedtestAction("wss")
    assert.equal(result.success, false)
    assert.ok(!JSON.stringify(result).includes("secret"))
    assert.ok(!JSON.stringify(result).includes(state.token))
  }
})

test("rejects unknown requested targets before exchanging any account credentials", async () => {
  assert.equal((await startSpeedtestAction("other")).success, false)
  assert.deepEqual(state.calls, [])
})

test("guests redirect to sign-in and expired account tokens are cleared", async () => {
  state.token = null
  await assert.rejects(startSpeedtestAction(), {
    message: "NEXT_REDIRECT",
    href: "/sign-in?redirect=%2Fdiagnostics",
  })
  assert.equal(state.calls.length, 1)
  state.token = "expired"
  state.error = new ApiError(401, "private account failure")
  await assert.rejects(startSpeedtestAction(), {
    message: "NEXT_REDIRECT",
    href: "/sign-in?redirect=%2Fdiagnostics",
  })
  assert.equal(state.token, null)
  assert.deepEqual(state.calls.at(-1), { clearAuthSession: true })
})

test("returns an actionable limit message and sanitizes other server failures", async () => {
  state.error = new ApiError(429, "internal limiter details")
  assert.match((await startSpeedtestAction()).message, /đợi một phút/)
  for (const status of [403, 500, 502]) {
    state.error = new ApiError(status, "private service secrets")
    assert.deepEqual(await startSpeedtestAction(), {
      success: false,
      message: "Không thể bắt đầu đo kết nối đến máy chủ. Vui lòng thử lại.",
    })
  }
})

test("an expired speedtest request cannot clear or redirect a newer login", async () => {
  state.error = new ApiError(401, "Previous session expired")
  state.beforeReject = () => {
    state.token = "new-session-token"
  }
  const result = await startSpeedtestAction()
  assert.equal(result.success, false)
  assert.match(result.message, /Phiên đăng nhập đã thay đổi/)
  assert.equal(state.token, "new-session-token")
  assert.equal(
    state.calls.some((call) => call.clearAuthSession),
    false
  )
})

test("rejects malformed grants, account tokens, and endpoints outside the fixed probe path", async () => {
  for (const mutation of [
    { token: state.token },
    { token: "invalid" },
    { expires_at: "tomorrow" },
    { endpoint_path: "https://untrusted.example.test/upload" },
    { endpoint_path: "/auth/me" },
    { endpoint_url: "https://untrusted.example.test/diagnostics/speedtest" },
    { target: "wss" },
    { limits: { ...state.response.limits, max_upload_bytes: -1 } },
  ]) {
    const original = state.response
    state.response = { ...original, ...mutation }
    const result = await startSpeedtestAction()
    assert.equal(result.success, false)
    assert.ok(!JSON.stringify(result).includes("private"))
    state.response = original
  }
})
