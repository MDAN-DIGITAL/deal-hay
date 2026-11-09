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
const authSchemas = await import(
  transpileModule("../src/modules/auth/schemas/auth.ts", {
    "@/lib/validation": validationUrl,
    zod: import.meta.resolve("zod"),
  })
)
const profileSchemas = await import(
  transpileModule("../src/modules/profile/schemas/profile.ts", {
    "@/lib/validation": validationUrl,
    zod: import.meta.resolve("zod"),
  })
)

const validPassword = "abc123"
const invalidPasswords = [
  "abc12",
  "abcdef",
  "123456",
  "Abc123",
  "abc123!",
  "abc 123",
  "ábc123",
]

function signUpValues(password = validPassword) {
  return {
    email: "person@example.com",
    password,
    password_confirmation: password,
    accept_terms: true,
  }
}

function resetPasswordValues(password = validPassword) {
  return {
    email: "person@example.com",
    token: "reset-token",
    password,
    password_confirmation: password,
  }
}

function updatePasswordValues(password = validPassword) {
  return {
    current_password: "legacy password ",
    password,
    password_confirmation: password,
  }
}

test("new passwords accept six lowercase alphanumeric characters with both letters and digits", () => {
  assert.equal(authSchemas.signUpSchema.safeParse(signUpValues()).success, true)
  assert.equal(
    authSchemas.resetPasswordSchema.safeParse(resetPasswordValues()).success,
    true
  )
  assert.equal(
    profileSchemas.updatePasswordSchema.safeParse(updatePasswordValues())
      .success,
    true
  )
})

test("registration, reset and profile changes reject every unsupported password shape", () => {
  for (const password of invalidPasswords) {
    assert.equal(
      authSchemas.signUpSchema.safeParse(signUpValues(password)).success,
      false,
      `sign up accepted ${JSON.stringify(password)}`
    )
    assert.equal(
      authSchemas.resetPasswordSchema.safeParse(resetPasswordValues(password))
        .success,
      false,
      `reset accepted ${JSON.stringify(password)}`
    )
    assert.equal(
      profileSchemas.updatePasswordSchema.safeParse(
        updatePasswordValues(password)
      ).success,
      false,
      `profile accepted ${JSON.stringify(password)}`
    )
  }
})

test("new passwords respect bcrypt's 72-byte boundary without restricting legacy login passwords", () => {
  const limit = `a${"1".repeat(71)}`
  for (const [schema, values] of [
    [authSchemas.signUpSchema, signUpValues],
    [authSchemas.resetPasswordSchema, resetPasswordValues],
    [profileSchemas.updatePasswordSchema, updatePasswordValues],
  ]) {
    assert.equal(schema.safeParse(values(limit)).success, true)
    assert.equal(schema.safeParse(values(`${limit}1`)).success, false)
  }
  assert.equal(
    authSchemas.signInSchema.safeParse({
      email: "person@example.com",
      password: `${limit}Legacy!`,
      remember: false,
      admin_verification_code: "",
    }).success,
    true
  )
})

test("login keeps accepting legacy passwords while requiring an explicit remember choice", () => {
  const result = authSchemas.signInSchema.safeParse({
    email: "person@example.com",
    password: "Legacy Password!1",
    remember: false,
    admin_verification_code: "",
  })

  assert.equal(result.success, true)
  assert.equal(
    authSchemas.signInSchema.safeParse({
      email: "person@example.com",
      password: "Legacy Password!1",
      admin_verification_code: "",
    }).success,
    false
  )
})

test("current password validation preserves legacy whitespace verbatim", () => {
  const result = profileSchemas.updatePasswordSchema.safeParse(
    updatePasswordValues()
  )

  assert.equal(result.success, true)
  assert.equal(result.data.current_password, "legacy password ")
})

test("password confirmation must match exactly and is never silently trimmed", () => {
  assert.equal(
    authSchemas.signUpSchema.safeParse({
      ...signUpValues(),
      password_confirmation: `${validPassword} `,
    }).success,
    false
  )
  assert.equal(
    profileSchemas.updatePasswordSchema.safeParse({
      ...updatePasswordValues(),
      password_confirmation: `${validPassword} `,
    }).success,
    false
  )
})

test("the login form explains safe session remembering without claiming to store passwords", () => {
  const signInSource = readFileSync(
    new URL("../src/modules/auth/components/sign-in-form.tsx", import.meta.url),
    "utf8"
  )
  const privacySource = readFileSync(
    new URL("../src/app/(application)/privacy/page.tsx", import.meta.url),
    "utf8"
  )

  assert.match(signInSource, /name="remember"/)
  assert.match(signInSource, /Ghi nhớ đăng nhập/)
  assert.match(signInSource, /không lưu mật khẩu/)
  assert.match(privacySource, /chỉ lưu mã\s+phiên/)
  assert.match(privacySource, /không lưu mật khẩu/)
})
