import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpileModule(path, imports = {}) {
  return moduleUrl(
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
const validation = transpileModule("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const browserImage = transpileModule("../src/lib/browser-image.ts", {
  "@/lib/validation": validation,
})
const storage = transpileModule("../src/lib/storage-upload.ts")
const grantsUrl = moduleUrl(`
export const state = { batches: [], discarded: [], failure: false }
export async function requestImageUploadsAction(purpose, uploads) {
  const batch = state.batches.length
  state.batches.push({ purpose, uploads })
  if (state.failure) return { success: false, message: "reservation failed" }
  const sessions = uploads.map((_, i) => ({ token: 'batch-' + batch + '-token-' + i,
    url: 'https://storage.example.test/upload/' + i + '?signature=scoped',
    headers: { 'Content-Type': 'image/webp', 'x-amz-meta-owner': 'owner' },
    asset_url: 'https://media.example.test/owner/' + purpose + '/' + i + '.webp' }))
  return { success: true, data: { tokens: sessions.map(s => s.token), uploads: sessions } }
}
export async function discardProductImageUploadsAction(tokens) { state.discarded.push(tokens) }
`)
const { state: grants } = await import(grantsUrl)
const { prepareBrowserImage } = await import(browserImage)
const { storageUploadUrl } = await import(storage)
const { prepareImageUploads } = await import(
  transpileModule("../src/lib/image-upload.ts", {
    "@/lib/form-utils": transpileModule("../src/lib/form-utils.ts"),
    "@/lib/browser-image": browserImage,
    "@/lib/storage-upload": storage,
    "@/lib/validation": validation,
    "@/modules/media/actions": grantsUrl,
  })
)
const state = {
  width: 4000,
  height: 3000,
  closed: 0,
  draws: [],
  qualities: [],
  decodes: [],
  uploads: [],
  statuses: [],
  bytes: 1024,
  mime: "image/webp",
  decodeError: false,
}
const original = () =>
  new File(["source metadata EXIF GPS pixels"], "camera.jpg", {
    type: "image/jpeg",
  })
globalThis.createImageBitmap = async (file, options) => {
  state.decodes.push({ file, options })
  if (state.decodeError) throw new Error("decode failed")
  return {
    width: state.width,
    height: state.height,
    close: () => state.closed++,
  }
}
globalThis.document = {
  createElement(type) {
    assert.equal(type, "canvas")
    return {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: (...args) => state.draws.push(args) }),
      toBlob(callback, mime, quality) {
        assert.equal(mime, "image/webp")
        state.qualities.push(quality)
        const bytes =
          typeof state.bytes === "function"
            ? state.bytes(this.width, this.height, quality)
            : state.bytes
        queueMicrotask(() =>
          callback(new Blob([new Uint8Array(bytes)], { type: state.mime }))
        )
      },
    }
  },
}
globalThis.XMLHttpRequest = class {
  upload = {}
  headers = {}
  open(method, url) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name, value) {
    this.headers[name] = value
  }
  getResponseHeader() {
    return "application/xml"
  }
  send(body) {
    this.body = body
    state.uploads.push(this)
    queueMicrotask(() => {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: body.size,
        total: body.size,
      })
      this.status = state.statuses.shift() ?? 200
      this.responseURL = this.url
      this.response = new ArrayBuffer(0)
      this.onload()
    })
  }
}
test.beforeEach(() => {
  Object.assign(state, {
    width: 4000,
    height: 3000,
    closed: 0,
    draws: [],
    qualities: [],
    decodes: [],
    uploads: [],
    statuses: [],
    bytes: 1024,
    mime: "image/webp",
    decodeError: false,
  })
  Object.assign(grants, { batches: [], discarded: [], failure: false })
})

test("browser applies EXIF orientation, preserves aspect ratio and re-encodes fresh WebP pixels", async () => {
  const file = original()
  const output = await prepareBrowserImage(file, "product")
  assert.equal(output.type, "image/webp")
  assert.equal(output.name, "camera.webp")
  assert.equal(output.size, 1024)
  assert.equal((await output.text()).includes("GPS"), false)
  assert.deepEqual(state.decodes[0], {
    file,
    options: { imageOrientation: "from-image" },
  })
  assert.deepEqual(state.draws[0].slice(1), [0, 0, 4000, 3000, 0, 0, 1280, 960])
  assert.equal(state.closed, 1)
})
test("avatar is center-cropped to a square without stretching", async () => {
  await prepareBrowserImage(original(), "avatar")
  assert.deepEqual(
    state.draws[0].slice(1),
    [500, 0, 3000, 3000, 0, 0, 640, 640]
  )
})
test("all image purposes decrease quality and dimensions until output fits 20 KiB", async () => {
  for (const purpose of ["product", "avatar", "review", "chat"]) {
    state.bytes = (width, height, quality) =>
      Math.ceil(width * height * quality)
    const output = await prepareBrowserImage(original(), purpose)
    assert.ok(output.size <= 20 * 1024)
    assert.ok(state.qualities.includes(0.44))
  }
  assert.ok(state.draws.length > 4)
  assert.equal(state.closed, 4)
})
test("unsupported WebP encoding fails and releases the decoded bitmap", async () => {
  state.mime = "image/png"
  await assert.rejects(prepareBrowserImage(original(), "avatar"), /WebP/)
  assert.equal(state.closed, 1)
})
test("invalid decoded dimensions are rejected before a canvas draw", async () => {
  state.width = Infinity
  await assert.rejects(prepareBrowserImage(original(), "product"), /Kích thước/)
  assert.equal(state.draws.length, 0)
  assert.equal(state.closed, 1)
})
test("product uploads only prepared bytes to storage and returns staged references in form order", async () => {
  const form = new FormData()
  form.set("name", "Product")
  form.set("image", original())
  form.append("gallery_images", original())
  form.append("gallery_images", original())
  const progress = []
  const output = await prepareImageUploads(form, "product", (value) =>
    progress.push(value)
  )
  assert.equal(output.get("name"), "Product")
  assert.equal(output.get("primary_image_upload"), "batch-0-token-0")
  assert.deepEqual(output.getAll("gallery_image_uploads"), [
    "batch-0-token-1",
    "batch-0-token-2",
  ])
  assert.ok([...output.values()].every((value) => typeof value === "string"))
  assert.equal(grants.batches[0].purpose, "product")
  assert.deepEqual(grants.batches[0].uploads[0], {
    size: 1024,
    content_type: "image/webp",
    filename: "camera.webp",
  })
  assert.equal(state.uploads.length, 3)
  for (const upload of state.uploads) {
    assert.equal(upload.method, "PUT")
    assert.equal(upload.withCredentials, false)
    assert.equal(upload.body.type, "image/webp")
    assert.equal(upload.body.size, 1024)
    assert.equal(upload.headers.Authorization, undefined)
    assert.match(upload.url, /^https:\/\/storage.example.test/)
  }
  assert.ok(
    progress.some(({ files }) =>
      files.some(({ stage }) => stage === "processing")
    )
  )
  assert.ok(
    progress.some(({ files }) =>
      files.some(({ stage, percent }) => stage === "uploading" && percent < 100)
    )
  )
  assert.equal(progress.at(-1).percent, 100)
})
test("avatar, review and chat return canonical URLs after browser processing and direct PUT", async () => {
  for (const [purpose, field] of [
    ["avatar", "avatar"],
    ["review", "image"],
    ["chat", "attachment"],
  ]) {
    const form = new FormData()
    form.set(field, original())
    form.set("body", "Caption")
    const output = await prepareImageUploads(form, purpose)
    assert.equal(
      output.get(field),
      `https://media.example.test/owner/${purpose}/0.webp`
    )
    assert.equal(output.get("body"), "Caption")
    assert.equal(
      [...output.values()].some((value) => value instanceof File),
      false
    )
  }
  assert.equal(state.uploads.length, 3)
})
test("non-image chat attachments pass through without an image reservation", async () => {
  const file = new File(["Document"], "document.txt", { type: "text/plain" })
  const form = new FormData()
  form.set("attachment", file)
  const output = await prepareImageUploads(form, "chat")
  assert.equal(output.get("attachment"), file)
  assert.equal(grants.batches.length, 0)
  assert.equal(state.uploads.length, 0)
})
test("failed storage upload discards every reservation and reports the original form field", async () => {
  const form = new FormData()
  form.set("image", original())
  state.statuses = [403]
  await assert.rejects(prepareImageUploads(form, "product"), (error) => {
    assert.ok(error.errors.image.length)
    return true
  })
  assert.deepEqual(grants.discarded, [["batch-0-token-0"]])
})
test("invalid source formats fail before storage reservations", async () => {
  const form = new FormData()
  form.set("image", new File(["svg"], "bad.svg", { type: "image/svg+xml" }))
  await assert.rejects(prepareImageUploads(form, "product"))
  assert.equal(grants.batches.length, 0)
  assert.equal(state.uploads.length, 0)
})
test("large originals are accepted and only the compressed image is uploaded", async () => {
  const form = new FormData()
  form.set(
    "image",
    new File([new Uint8Array(25 * 1024 * 1024)], "big.png", {
      type: "image/png",
    })
  )
  state.width = 12000
  state.height = 8000
  state.bytes = (width, height, quality) => Math.ceil(width * height * quality)
  await prepareImageUploads(form, "product")
  assert.equal(state.uploads.length, 1)
  assert.ok(state.uploads[0].body.size <= 20 * 1024)
  assert.ok(state.draws[0].at(-2) <= 1280)
  assert.ok(state.draws[0].at(-1) <= 1280)
})
test("decode failures never send original bytes or request upload credentials", async () => {
  state.decodeError = true
  const form = new FormData()
  form.set("avatar", original())
  await assert.rejects(prepareImageUploads(form, "avatar"), /decode failed/)
  assert.equal(grants.batches.length, 0)
  assert.equal(state.uploads.length, 0)
})
test("direct upload accepts 51 product references without multipart image bytes", async () => {
  const form = new FormData()
  form.set("image", original())
  for (let i = 0; i < 50; i++) form.append("gallery_images", original())
  const output = await prepareImageUploads(form, "product")
  assert.equal(output.getAll("gallery_image_uploads").length, 50)
  assert.equal(state.uploads.length, 51)
})
test("storage URLs require HTTPS except loopback and reject embedded credentials or fragments", () => {
  assert.equal(
    storageUploadUrl("https://storage.example.test/key?signature=abc").search,
    "?signature=abc"
  )
  assert.equal(storageUploadUrl("http://localhost:9000/key").port, "9000")
  for (const url of [
    "http://storage.example.test/key",
    "https://user:secret@storage.example.test/key",
    "https://storage.example.test/key#secret",
    "javascript:alert(1)",
  ])
    assert.throws(() => storageUploadUrl(url))
})
