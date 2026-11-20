import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`

function transpileModule(path, imports = {}) {
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

const validationUrl = transpileModule("../src/lib/validation.ts", {
  zod: import.meta.resolve("zod"),
})
const variantsUrl = transpileModule(
  "../src/modules/shop-management/lib/product-variants.ts"
)
const schemaUrl = transpileModule(
  "../src/modules/shop-management/schemas/shop-management.ts",
  {
    zod: import.meta.resolve("zod"),
    "@/lib/validation": validationUrl,
    "@/modules/shop-management/lib/product-variants": variantsUrl,
  }
)
const { createProductSchema, productGallerySchema } = await import(schemaUrl)
const apiUrl = moduleUrl(`
  export class ApiError extends Error {}
  export const state = { calls: [], revalidated: [] }
  export async function apiFetch(options) {
    state.calls.push(options)
    return { message: "Đã lưu." }
  }
  export async function createProduct(body) {
    state.calls.push({ body })
    return { message: "Đã tạo." }
  }
  export function invalidateQueries(path) { state.revalidated.push(path) }
  export const replyToReview = () => {};
  export const createCoupon = () => {}; export const deleteCoupon = () => {};
  export const deleteProduct = () => {}; export const adjustInventory = () => {};
  export const reorderCategories = () => {}; export const updateOrderStatus = () => {};
  export const updateProductStatus = () => {};
`)
const actions = await import(
  transpileModule("../src/modules/shop-management/actions.ts", {
    "@/lib/query-cache": apiUrl,
    "@/api/client": apiUrl,
    "@/api/catalog/mutations": apiUrl,
    "@/api/profile/mutations": apiUrl,
    "@/modules/shop-management/lib/product-variants": variantsUrl,
    "@/modules/shop-management/schemas/shop-management": schemaUrl,
  })
)
const { state } = await import(apiUrl)

function productDraft(overrides = {}) {
  return {
    name: "Áo thun",
    category: "Thời trang",
    price: 80000,
    old_price: 100000,
    video_url: "",
    stock: 10,
    label: "",
    description: "Sản phẩm mới",
    image: new File(["image"], "product.webp", { type: "image/webp" }),
    gallery_images: [],
    has_variants: false,
    options: [],
    variants: [],
    ...overrides,
  }
}

function productFormData(overrides = {}) {
  const draft = productDraft(overrides)
  const form = new FormData()
  for (const field of [
    "name",
    "category",
    "price",
    "old_price",
    "video_url",
    "stock",
    "label",
    "description",
  ]) {
    form.set(field, String(draft[field]))
  }
  form.set("primary_image_upload", "prepared-product-token")
  form.set(
    "catalog",
    JSON.stringify({ has_variants: false, options: [], variants: [] })
  )
  return form
}

test.beforeEach(() => {
  state.calls.length = 0
  state.revalidated.length = 0
})

test("editing prices rejects inconsistent amounts and non-HTTPS video URLs before calling the API", async () => {
  const invalid = await actions.updateProductPricingAction(
    "product",
    productFormData({
      price: 80000,
      old_price: 80000,
      video_url: "http://example.com/video",
    })
  )
  assert.equal(invalid.success, false)
  assert.ok(invalid.errors.old_price)
  assert.ok(invalid.errors.video_url)
  assert.deepEqual(state.calls, [])

  const valid = await actions.updateProductPricingAction(
    "product",
    productFormData({ old_price: "", video_url: "" })
  )
  assert.equal(valid.success, true)
  assert.deepEqual(state.calls[0].body, {
    price: 80000,
    old_price: null,
    video_url: null,
  })
})

test("the product gallery validates the total and allows source images with an unidentified format", () => {
  const image = productDraft().image
  assert.equal(
    productGallerySchema.safeParse(Array(5).fill(image)).success,
    true
  )
  assert.equal(
    productGallerySchema.safeParse(Array(6).fill(image)).success,
    false
  )
  const cameraImage = new File(["source"], "camera.heic")
  assert.equal(
    productGallerySchema.safeParse([image, cameraImage]).success,
    true
  )
  const invalid = productGallerySchema.safeParse([
    image,
    new File([], "empty.jpg"),
  ])
  assert.equal(invalid.success, false)
  assert.deepEqual(invalid.error.issues[0].path, [1])
})

test("shops can configure a discount without adding an advertising video", () => {
  const parsed = createProductSchema.safeParse(productDraft())
  assert.equal(parsed.success, true)
  assert.equal(parsed.data.old_price, 100000)
  assert.equal(parsed.data.price, 80000)
})

test("discounts still require an original price above the sale price", () => {
  const parsed = createProductSchema.safeParse(
    productDraft({ old_price: 70000 })
  )
  assert.equal(parsed.success, false)
  assert.ok(parsed.error.issues.some((issue) => issue.path[0] === "old_price"))
})

test("camera batches larger than one request remain valid for staged uploads", () => {
  const cameraImage = new File(
    [new Uint8Array(6 * 1024 * 1024)],
    "camera.jpg",
    { type: "image/jpeg" }
  )

  const parsed = createProductSchema.safeParse(
    productDraft({ image: cameraImage, gallery_images: [cameraImage] })
  )

  assert.equal(parsed.success, true)
})

test("source images above 10 MB are accepted for compression while galleries remain limited to five images", () => {
  const oversized = new File(
    [new Uint8Array(10 * 1024 * 1024 + 1)],
    "large.jpg",
    { type: "image/jpeg" }
  )
  assert.equal(
    createProductSchema.safeParse(productDraft({ image: oversized })).success,
    true
  )
  const image = productDraft().image
  assert.equal(
    createProductSchema.safeParse(
      productDraft({ gallery_images: Array(6).fill(image) })
    ).success,
    false
  )
})

test("a staged six-image product submission forwards references without any image binaries", async () => {
  const form = productFormData()
  form.delete("image")
  form.set("primary_image_upload", "primary-upload-token")
  const description = JSON.stringify({
    type: "doc",
    content: [{ type: "image", attrs: { imageId: "gallery:4" } }],
  })
  form.set("description_content", description)
  for (let index = 0; index < 5; index++) {
    form.append("gallery_image_uploads", `gallery-upload-token-${index}`)
  }

  const result = await actions.createProductAction(form)
  assert.equal(result.success, true)
  const payload = state.calls[0].body
  assert.equal(payload.get("primary_image_upload"), "primary-upload-token")
  assert.equal(payload.get("description_content"), description)
  assert.deepEqual(
    payload.getAll("gallery_image_uploads[]"),
    Array.from({ length: 5 }, (_, index) => `gallery-upload-token-${index}`)
  )
  assert.equal(payload.has("image"), false)
  assert.equal(payload.has("gallery_images[]"), false)
  assert.ok(
    Array.from(payload.values()).every((value) => typeof value === "string")
  )
})

test("staged uploads retain catalog validation and reject galleries above five images", async () => {
  const form = productFormData()
  form.delete("image")
  form.set("primary_image_upload", "primary-upload-token")
  for (let index = 0; index < 6; index++)
    form.append("gallery_image_uploads", `gallery-${index}`)
  const result = await actions.createProductAction(form)
  assert.equal(result.success, false)
  assert.ok(result.errors.gallery_image_uploads)
  assert.equal(state.calls.length, 0)

  form.delete("gallery_image_uploads")
  form.set(
    "catalog",
    JSON.stringify({ has_variants: true, options: [], variants: [] })
  )
  const invalidCatalog = await actions.createProductAction(form)
  assert.equal(invalidCatalog.success, false)
  assert.ok(invalidCatalog.errors.variants)
  assert.equal(state.calls.length, 0)
})

test("the server action rejects binary image submissions before calling Laravel", async () => {
  const cameraImage = new File(
    [new Uint8Array(6 * 1024 * 1024)],
    "camera.jpg",
    { type: "image/jpeg" }
  )
  const form = productFormData({ image: cameraImage })
  form.delete("primary_image_upload")
  form.set("image", cameraImage)
  form.append("gallery_images", cameraImage)

  const result = await actions.createProductAction(form)

  assert.equal(result.success, false)
  assert.ok(result.errors.primary_image_upload)
  assert.equal(state.calls.length, 0)
})

test("discounted product creation forwards product media and ignores manual ad fields", async () => {
  const form = productFormData({ video_url: "https://example.com/product.mp4" })
  form.set("advertisement_video_url", "https://example.com/manual-ad.mp4")
  form.set("advertisement_duration_seconds", "30")
  const result = await actions.createProductAction(form)
  assert.equal(result.success, true)
  assert.equal(state.calls.length, 1)
  const payload = state.calls[0].body
  assert.equal(payload.get("old_price"), "100000")
  assert.equal(payload.get("price"), "80000")
  assert.equal(payload.get("video_url"), "https://example.com/product.mp4")
  assert.equal(payload.has("advertisement_video_url"), false)
  assert.equal(payload.has("advertisement_duration_seconds"), false)
})

test("price updates keep product media separate from centrally supplied ads", async () => {
  const form = productFormData({ video_url: "https://example.com/product.mp4" })
  form.set("advertisement_video_url", "https://example.com/manual-ad.mp4")
  form.set("advertisement_duration_seconds", "30")
  const result = await actions.updateProductPricingAction("product-1", form)
  assert.equal(result.success, true)
  assert.equal(state.calls[0].method, "PATCH")
  assert.deepEqual(state.calls[0].body, {
    old_price: 100000,
    price: 80000,
    video_url: "https://example.com/product.mp4",
  })
})

test("product server action requires staged references and never forwards original images", async () => {
  const form = productFormData()
  form.delete("primary_image_upload")
  form.set("image", productDraft().image)
  const result = await actions.createProductAction(form)
  assert.equal(result.success, false)
  assert.ok(result.errors.primary_image_upload)
  assert.equal(state.calls.length, 0)
})

test("description images follow the current gallery order and removed images and preview URLs are omitted", async () => {
  const { productImageId, serializeProductDescription } = await import(
    transpileModule("../src/lib/product-description.ts")
  )
  const primary = new File(["primary"], "main.jpg")
  const removed = new File(["removed"], "removed.jpg")
  const retained = new File(["retained"], "retained.jpg")
  const content = [removed, retained, primary].map((file) => ({
    type: "image",
    attrs: {
      imageId: productImageId(file),
      src: "blob:local-preview",
      alt: file.name,
    },
  }))
  const draft = JSON.stringify({ type: "doc", content })

  const description = JSON.parse(
    serializeProductDescription(draft, primary, [retained])
  )

  assert.deepEqual(
    description.content.map(({ attrs }) => attrs),
    [
      { imageId: "gallery:0", alt: "retained.jpg" },
      { imageId: "primary", alt: "main.jpg" },
    ]
  )
})
