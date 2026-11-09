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
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
      assert.ok(imports[name], `Unexpected import ${name}`)
      return `from ${quote}${imports[name]}${quote}`
    })
  )
}

const validation = transpile("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const schema = transpile("../src/modules/profile/schemas/profile.ts", {
  zod: import.meta.resolve("zod"),
  "@/lib/validation": validation,
})
const mocks = moduleUrl(`
  export const state = { token: "account-a", calls: [], profileCalls: [], profileError: null, shopCalls: [], shopError: null, cleared: [], error: null, wait: null }
  export class ApiError extends Error {
    constructor(message, errors = {current_password:[message]}) { super(message); this.errors = errors }
  }
  export function getAccessToken() { return state.token }
  export function clearAccessToken(expected) {
    state.cleared.push(expected)
    if (state.token === expected) state.token = null
  }
  export async function updatePassword(values) {
    state.calls.push(values)
    await state.wait
    if (state.error) throw state.error
    return {message:"Cập nhật mật khẩu thành công."}
  }
  export function invalidateQueries() {}
  export function updateAvatar() { throw new Error("Unexpected avatar update") }
  export async function updateProfile(values) {
    state.profileCalls.push(values)
    if (state.profileError) throw state.profileError
    return {message:"Cập nhật thông tin thành công."}
  }
  export async function updateShop(values) {
    state.shopCalls.push(values)
    if (state.shopError) throw state.shopError
    return {message:"Cập nhật thông tin shop thành công."}
  }
  export function createShopOwnerUpgrade() { throw new Error("Unexpected shop upgrade") }
  export const profileRoutes = {}
`)
const { state, ApiError } = await import(mocks)
const { updatePasswordAction, updateProfileAction, updateShopProfileAction } =
  await import(
    transpile("../src/modules/profile/actions.ts", {
      "@/lib/query-cache": mocks,
      "@/lib/session": mocks,
      "@/api/client": mocks,
      "@/api/profile/mutations": mocks,
      "@/api/profile/routes": mocks,
      "@/modules/profile/schemas/profile": schema,
    })
  )
const password = {
  current_password: "Legacy Password!1",
  password: "new123",
  password_confirmation: "new123",
}
const profile = {
  full_name: "Nguyễn An",
  email: "person@example.com",
  phone_number: "",
  province: "",
  ward: "",
  address_detail: "",
}
const shopProfile = {
  shop_name: "Cửa hàng kiểm thử",
  shop_email: "shop@example.com",
  shop_phone_number: "0987654321",
  shop_province: "Thành phố Hà Nội",
  shop_ward: "Phường Hoàn Kiếm",
  shop_address_detail: "12 Hàng Bài",
}

test.beforeEach(() => {
  state.token = "account-a"
  state.calls = []
  state.profileCalls = []
  state.profileError = null
  state.shopCalls = []
  state.shopError = null
  state.cleared = []
  state.error = null
  state.wait = null
})

test("a successful password change immediately removes the revoked browser credential", async () => {
  const result = await updatePasswordAction(password)
  assert.equal(result.success, true)
  assert.match(result.message, /Vui lòng đăng nhập lại/)
  assert.deepEqual(state.calls, [password])
  assert.deepEqual(state.cleared, ["account-a"])
  assert.equal(state.token, null)
})

test("an invalid password never reaches the API or logs the account out", async () => {
  const result = await updatePasswordAction({ ...password, password: "short" })
  assert.equal(result.success, false)
  assert.deepEqual(state.calls, [])
  assert.deepEqual(state.cleared, [])
  assert.equal(state.token, "account-a")
})

test("a rejected current password preserves the active account and its field errors", async () => {
  state.error = new ApiError("Mật khẩu hiện tại không chính xác.")
  const result = await updatePasswordAction(password)
  assert.equal(result.success, false)
  assert.deepEqual(result.errors, state.error.errors)
  assert.deepEqual(state.cleared, [])
  assert.equal(state.token, "account-a")
})

test("a delayed password response cannot clear the account signed in from another tab", async () => {
  let finish
  state.wait = new Promise((resolve) => {
    finish = resolve
  })
  const result = updatePasswordAction(password)
  state.token = "account-b"
  finish()
  assert.equal((await result).success, true)
  assert.deepEqual(state.cleared, [])
  assert.equal(state.token, "account-b")
})

test("clearing optional contact fields sends explicit null values instead of silently retaining saved values", async () => {
  const result = await updateProfileAction(profile)
  assert.equal(result.success, true)
  assert.deepEqual(state.profileCalls, [
    {
      ...profile,
      phone_number: null,
      province: null,
      ward: null,
      address_detail: null,
      email_change_code: undefined,
    },
  ])
})

test("email verification codes are validated and forwarded so a challenged change can complete", async () => {
  state.profileError = new ApiError("Vui lòng nhập mã xác thực.", {
    email_change_code: ["Mã xác thực đã được gửi về email hiện tại."],
  })
  const challenge = await updateProfileAction(profile)
  assert.equal(challenge.success, false)
  assert.deepEqual(challenge.errors, state.profileError.errors)
  state.profileCalls = []
  state.profileError = null
  const result = await updateProfileAction({
    ...profile,
    email_change_code: "123456",
  })
  assert.equal(result.success, true)
  assert.equal(state.profileCalls[0].email_change_code, "123456")
})

test("malformed verification codes cannot reach the profile API", async () => {
  for (const email_change_code of [
    "12345",
    "abcdef",
    "1234567",
    123456,
    ["123456"],
  ]) {
    const result = await updateProfileAction({ ...profile, email_change_code })
    assert.equal(result.success, false)
    assert.ok(result.errors.email_change_code.length)
  }
  assert.deepEqual(state.profileCalls, [])
})

test("shop email verification challenges preserve their field error and forward the confirmation code", async () => {
  state.shopError = new ApiError("Vui lòng nhập mã xác thực.", {
    email_change_code: ["Mã xác thực đã được gửi về email shop cũ."],
  })
  const challenge = await updateShopProfileAction(shopProfile)
  assert.equal(challenge.success, false)
  assert.deepEqual(challenge.errors, state.shopError.errors)

  state.shopCalls = []
  state.shopError = null
  const result = await updateShopProfileAction({
    ...shopProfile,
    email_change_code: "123456",
  })
  assert.equal(result.success, true)
  assert.equal(state.shopCalls[0].email_change_code, "123456")
})

test("malformed verification codes cannot reach the shop profile API", async () => {
  for (const email_change_code of [
    "12345",
    "abcdef",
    "1234567",
    123456,
    ["123456"],
  ]) {
    const result = await updateShopProfileAction({
      ...shopProfile,
      email_change_code,
    })
    assert.equal(result.success, false)
    assert.ok(result.errors.email_change_code.length)
  }
  assert.deepEqual(state.shopCalls, [])
})

test("shop profile changes without an email challenge remain usable without a verification code", async () => {
  const result = await updateShopProfileAction(shopProfile)
  assert.equal(result.success, true)
  assert.equal(state.shopCalls.length, 1)
  assert.equal(state.shopCalls[0].shop_email, shopProfile.shop_email)
  assert.equal(state.shopCalls[0].email_change_code, undefined)
})
