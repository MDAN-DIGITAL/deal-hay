import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function module(path, imports = {}) {
  return url(
    ts
      .transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
        assert.ok(imports[name], `Unmocked import: ${name}`)
        return `from ${quote}${imports[name]}${quote}`
      })
  )
}
const validation = module("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const profileSchema = module("../src/modules/profile/schemas/profile.ts", {
  zod: import.meta.resolve("zod"),
  "@/lib/validation": validation,
})
const reviewSchema = module("../src/modules/public/schemas/reviews.ts", {
  zod: import.meta.resolve("zod"),
  "@/lib/validation": validation,
})
const { avatarSchema, avatarUploadSchema } = await import(profileSchema)
const { reviewProductSchema, reviewProductUploadSchema } = await import(
  reviewSchema
)
const api = url(`
export class ApiError extends Error {}
export const calls=[]
export const state={response:null}
export const invalidateQueries=()=>{}
export const updateAvatar=async(...args)=>{calls.push(args);return{message:'Saved'}}
export const updatePassword=()=>{}; export const updateProfile=()=>{}; export const updateShop=()=>{}; export const createShopOwnerUpgrade=()=>{}
export const profileRoutes={avatar:'/private/me/avatar',shopAvatar:'/private/shop/avatar'}
export async function apiFetch(request){calls.push(request);if(request.method==='DELETE')return{};return state.response ?? {uploads:request.body.uploads.map((_,i)=>({token:'token-'+i,url:'https://storage.example.test/key-'+i+'?signature=abc',headers:{'Content-Type':'image/webp'},asset_url:'https://media.example.test/key-'+i+'.webp'}))}}
export const wssFetch=apiFetch
`)
const { calls, state } = await import(api)
const actions = await import(
  module("../src/modules/profile/actions.ts", {
    "@/lib/query-cache": api,
    "@/api/client": api,
    "@/api/wss-client": api,
    "@/api/profile/mutations": api,
    "@/api/profile/routes": api,
    "@/modules/profile/schemas/profile": profileSchema,
  })
)
const { requestImageUploadsAction } = await import(
  module("../src/modules/media/actions.ts", {
    zod: import.meta.resolve("zod"),
    "@/api/client": api,
    "@/api/wss-client": api,
    "@/lib/storage-upload": module("../src/lib/storage-upload.ts"),
  })
)
const rawImage = () =>
  new File(["raw image"], "camera.jpg", { type: "image/jpeg" })
const imageUrl = "https://media.example.test/owner/avatar/image.webp"
test.beforeEach(() => {
  calls.length = 0
  state.response = null
})
test("UI schemas accept selected files while mutation schemas require uploaded URLs", () => {
  assert.equal(avatarSchema.safeParse({ avatar: rawImage() }).success, true)
  assert.equal(
    avatarUploadSchema.safeParse({ avatar: rawImage() }).success,
    false
  )
  assert.equal(avatarUploadSchema.safeParse({ avatar: imageUrl }).success, true)
  const review = {
    reaction: "like",
    content: "Sản phẩm tốt",
    image: rawImage(),
  }
  assert.equal(reviewProductSchema.safeParse(review).success, true)
  assert.equal(reviewProductUploadSchema.safeParse(review).success, false)
  assert.equal(
    reviewProductUploadSchema.safeParse({ ...review, image: imageUrl }).success,
    true
  )
  assert.equal(
    reviewProductUploadSchema.safeParse({ ...review, image: undefined })
      .success,
    true
  )
})
test("profile and shop actions forward only URL references and reject raw files", async () => {
  for (const action of [
    actions.updateAvatarAction,
    actions.updateShopAvatarAction,
  ]) {
    const form = new FormData()
    form.set("avatar", rawImage())
    assert.equal((await action(form)).success, false)
    assert.equal(calls.length, 0)
    form.set("avatar", imageUrl)
    assert.equal((await action(form)).success, true)
    assert.equal(calls[0][1].get("avatar"), imageUrl)
    calls.length = 0
  }
})
test("URL references reject temporary signatures, credentials, data URLs and insecure origins", () => {
  for (const avatar of [
    "not-a-url",
    "data:image/webp;base64,YQ==",
    "https://media.test/key?signature=abc",
    "https://user:secret@media.test/key",
    "http://media.test/key",
    "https://media.test/key#hash",
  ])
    assert.equal(avatarUploadSchema.safeParse({ avatar }).success, false)
})
test("upload session requests contain only prepared WebP descriptors bounded for each purpose", async () => {
  for (const [purpose, size] of [
    ["product", 20 * 1024],
    ["avatar", 20 * 1024],
    ["review", 20 * 1024],
    ["chat", 20 * 1024],
  ]) {
    const uploads = [
      { size, content_type: "image/webp", filename: "prepared.webp" },
    ]
    const result = await requestImageUploadsAction(purpose, uploads)
    assert.equal(result.success, true)
    assert.deepEqual(calls.at(-1).body, { purpose, uploads })
    assert.equal(
      calls.at(-1).path,
      purpose === "chat" ? "/chat-uploads/images" : "/private/uploads/images"
    )
    assert.deepEqual(result.data.tokens, ["token-0"])
    assert.equal(
      (
        await requestImageUploadsAction(purpose, [
          { ...uploads[0], size: size + 1 },
        ])
      ).success,
      false
    )
    assert.equal(
      (
        await requestImageUploadsAction(purpose, [
          { ...uploads[0], content_type: "image/jpeg" },
        ])
      ).success,
      false
    )
  }
})
test("unknown session fields are stripped and malformed storage headers release reservations", async () => {
  state.response = {
    uploads: [
      {
        token: "staged",
        url: "https://storage.example.test/key?signature=abc",
        headers: { "Content-Type": "image/webp" },
        asset_url: imageUrl,
        internal_secret: "secret",
      },
    ],
  }
  const descriptor = [{ size: 1024, content_type: "image/webp" }]
  const result = await requestImageUploadsAction("avatar", descriptor)
  assert.equal(result.success, true)
  assert.equal(result.data.uploads[0].internal_secret, undefined)
  state.response.uploads[0].headers.Authorization = "Bearer must-not-leak"
  assert.equal(
    (await requestImageUploadsAction("avatar", descriptor)).success,
    false
  )
  assert.equal(calls.at(-1).method, "DELETE")
  assert.deepEqual(calls.at(-1).body.tokens, ["staged"])
})
test("legacy R2 sessions with an empty header array stay usable for chat and products", async () => {
  for (const purpose of ["chat", "product"]) {
    calls.length = 0
    const key = `staged-images/owner/${purpose}/image.webp`
    state.response = {
      uploads: [
        {
          token: "reserved",
          url: `https://account.r2.cloudflarestorage.com/deal-hay-bucket/${key}?X-Amz-SignedHeaders=host&X-Amz-Signature=test`,
          headers: [],
          asset_url: `https://account.r2.cloudflarestorage.com/deal-hay-bucket/${key}`,
        },
      ],
    }

    const result = await requestImageUploadsAction(purpose, [
      { size: 1024, content_type: "image/webp" },
    ])

    assert.equal(result.success, true)
    assert.deepEqual(result.data.tokens, ["reserved"])
    assert.deepEqual(result.data.uploads[0].headers, {})
    assert.equal(result.data.uploads[0].url, state.response.uploads[0].url)
    assert.deepEqual(
      calls.map(({ method }) => method),
      ["POST"]
    )
  }
})
test("malformed header arrays and values still reject sessions and release their tokens", async () => {
  for (const headers of [
    ["Content-Type", "image/webp"],
    [{ "Content-Type": "image/webp" }],
    null,
    { "Content-Type": ["image/webp"] },
    { "Content-Type": 123 },
  ]) {
    calls.length = 0
    state.response = {
      uploads: [
        {
          token: "reserved",
          url: "https://storage.example.test/key?signature=abc",
          headers,
          asset_url: imageUrl,
        },
      ],
    }

    const result = await requestImageUploadsAction("chat", [
      { size: 1024, content_type: "image/webp" },
    ])

    assert.equal(result.success, false)
    assert.deepEqual(
      calls.map(({ method }) => method),
      ["POST", "DELETE"]
    )
    assert.deepEqual(calls.at(-1).body.tokens, ["reserved"])
  }
})
test("missing sessions release the entire reservation batch", async () => {
  state.response = {
    uploads: [
      {
        token: "reserved",
        url: "https://storage.example.test/key?signature=abc",
        headers: {},
        asset_url: imageUrl,
      },
    ],
  }
  const result = await requestImageUploadsAction("product", [
    { size: 1024, content_type: "image/webp" },
    { size: 1024, content_type: "image/webp" },
  ])
  assert.equal(result.success, false)
  assert.equal(calls.at(-1).method, "DELETE")
  assert.deepEqual(calls.at(-1).body.tokens, ["reserved"])
})
