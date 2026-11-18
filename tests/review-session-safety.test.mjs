import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(path, imports = {}) {
  return moduleUrl(
    ts
      .transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
      })
      .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
        assert.ok(imports[name], `Unexpected import: ${name}`)
        return `from ${quote}${imports[name]}${quote}`
      })
  )
}
const runtime = moduleUrl(`
 export default "a"
 export const jsx=(type,props,key)=>({type,props,key}),jsxs=jsx,Fragment="fragment"
 export const useState=(initial)=>[typeof initial==="function"?initial():initial,()=>{}]
 export const useTransition=()=>[false,(run)=>{globalThis.__reviewTest.pending=run()}]
 export const useForm=(options)=>globalThis.__reviewTest.getForm(options)
 export const useWatch=({name})=>globalThis.__reviewTest.values[name]
 export const useImageUpload=()=>({prepareUploads:(...args)=>globalThis.__reviewTest.prepare(...args),uploadProgress:null})
 export const getSessionId=()=>globalThis.__reviewTest.token
 export const reviewProductAction=(...args)=>globalThis.__reviewTest.save(...args)
 export const deleteReviewAction=()=>{},zodResolver=()=>({})
 export const toast={success:(message)=>globalThis.__reviewTest.toasts.push(["success",message]),error:(message)=>globalThis.__reviewTest.toasts.push(["error",message])}
 export const cn=(...values)=>values.filter(Boolean).join(" "),buttonVariants=()=>"button"
 export const reviewProductSchema={},IMAGE_UPLOAD_ACCEPT="image/*"
 export const defaultProductVariant=()=>undefined, selectProductVariant=()=>undefined,variantHasOption=()=>false
 export const productCheckoutHref=()=>"/checkout",productOfferHref=()=>"/offer"
 export const productPricing=()=>({salePrice:10000,originalPrice:null}),formatCurrency=String
 export const BadgeCheckIcon="icon",CirclePlayIcon="icon",PackageCheckIcon="icon",Trash2Icon="icon",ShoppingBagIcon="icon",TicketPercentIcon="icon"
 export const FormSelect="select",FormSubmitButton="submit",ImagePreview="image-preview",SelectedFilePreview="selected-file",Badge="badge",Button="button",Card="card",CardContent="content",CardDescription="description",CardHeader="header",CardTitle="title",Form="form-provider",FormControl="control",FormField="field",FormItem="item",FormLabel="label",FormMessage="message",Input="input",Separator="separator",Surface="surface",Textarea="textarea",UserAvatar="avatar",ImageUploadProgress="progress",ShopEngagement="engagement"
`)
const imports = { "@/lib/form-utils": transpile("../src/lib/form-utils.ts") }
for (const name of [
  "react/jsx-runtime",
  "next/link",
  "react",
  "@hookform/resolvers/zod",
  "lucide-react",
  "react-hook-form",
  "sonner",
  "cn",
  "@/components/form-select",
  "@/components/form-submit-button",
  "@/components/image-preview",
  "@/components/selected-file-preview",
  "@/components/ui/badge",
  "@/components/ui/button",
  "@/components/ui/card",
  "@/components/ui/form",
  "@/components/ui/input",
  "@/components/ui/separator",
  "@/components/ui/surface",
  "@/components/ui/textarea",
  "@/components/user-avatar",
  "@/lib/validation",
  "@/lib/session",
  "@/components/image-upload-progress",
  "@/hooks/use-image-upload",
  "@/lib/format",
  "@/modules/public/actions",
  "@/modules/public/components/shop-engagement",
  "@/modules/public/schemas/reviews",
  "@/modules/public/lib/variant-selection",
  "@/modules/public/lib/product-checkout",
  "@/modules/public/lib/product-pricing",
])
  imports[name] = runtime
const { ProductInteractions } = await import(
  transpile(
    "../src/modules/public/components/product-interactions.tsx",
    imports
  )
)
const nodes = (node) =>
  !node || typeof node !== "object"
    ? []
    : [
        node,
        ...[]
          .concat(node.props?.children ?? [])
          .flat(Infinity)
          .flatMap(nodes),
      ]
function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function mount({ photo = false } = {}) {
  const upload = deferred(),
    response = deferred()
  const screen = {
    token: "account-a",
    values: null,
    resets: [],
    errors: [],
    toasts: [],
    requests: [],
    uploads: [],
    pending: null,
    getForm({ defaultValues }) {
      this.values ??= {
        ...defaultValues,
        ...(photo
          ? {
              image: new File(["private photo"], "a.jpg", {
                type: "image/jpeg",
              }),
            }
          : {}),
      }
      return {
        control: {},
        handleSubmit: (save) => () => save({ ...this.values }),
        setError: (...args) => this.errors.push(args),
        reset: (values) => this.resets.push(values),
      }
    },
    prepare(payload, purpose, isCurrent) {
      this.uploads.push({ payload, purpose, isCurrent })
      return upload.promise
    },
    save(shop, product, payload, token) {
      this.requests.push({
        shop,
        product,
        payload,
        token,
        currentToken: this.token,
      })
      return response.promise
    },
    upload,
    response,
  }
  globalThis.__reviewTest = screen
  const page = ProductInteractions({
    shop: { code: "shop", name: "Shop", viewer: {} },
    product: {
      id: "product",
      slug: "product",
      name: "Product",
      variants: [],
      options: [],
      has_variants: false,
      stock: 1,
    },
    canReview: true,
    viewerReview: {
      id: "review-a",
      reaction: "dislike",
      content: "Private prefilled account A review",
      image_url: "https://media.test/a.webp",
    },
  })
  const formComponent = nodes(page).find(
    (n) => typeof n.type === "function" && n.type.name === "ReviewProductForm"
  )
  assert.ok(formComponent)
  const form = nodes(formComponent.type(formComponent.props)).find(
    (n) => n.type === "form"
  )
  screen.submit = () => form.props.onSubmit()
  return screen
}
async function until(check) {
  for (let i = 0; i < 20; i++) {
    if (check()) return
    await Promise.resolve()
  }
  assert.ok(check())
}
test.afterEach(() => {
  delete globalThis.__reviewTest
})

test("an account switch during photo preparation blocks A's review from being posted as B", async () => {
  const screen = mount({ photo: true })
  screen.submit()
  assert.equal(screen.uploads[0].isCurrent(), true)
  assert.equal(screen.uploads[0].purpose, "review")
  assert.equal(
    screen.uploads[0].payload.get("content"),
    "Private prefilled account A review"
  )
  screen.token = "account-b"
  assert.equal(screen.uploads[0].isCurrent(), false)
  screen.upload.resolve(new FormData())
  await screen.pending
  assert.equal(screen.requests.length, 0)
  assert.deepEqual(screen.resets, [])
  assert.deepEqual(screen.errors, [])
  assert.deepEqual(screen.toasts, [])
})
test("stale photo failure after logout does not alter the next account's form or toast", async () => {
  const screen = mount({ photo: true })
  screen.submit()
  screen.token = null
  screen.upload.reject(new Error("Session changed during upload"))
  await screen.pending
  assert.equal(screen.requests.length, 0)
  assert.deepEqual(screen.resets, [])
  assert.deepEqual(screen.errors, [])
  assert.deepEqual(screen.toasts, [])
})
test("late success and server validation responses cannot reset or annotate B's form", async () => {
  for (const result of [
    { success: true, message: "Saved" },
    {
      success: false,
      message: "Invalid",
      errors: { content: ["A's server error"] },
    },
  ]) {
    const screen = mount()
    screen.submit()
    screen.upload.resolve(screen.uploads[0].payload)
    await until(() => screen.requests.length === 1)
    assert.equal(screen.requests[0].token, "account-a")
    screen.token = "account-b"
    screen.response.resolve(result)
    await screen.pending
    assert.deepEqual(screen.resets, [])
    assert.deepEqual(screen.errors, [])
    assert.deepEqual(screen.toasts, [])
  }
})
test("an unchanged account can update its prefilled review and receive its own result", async () => {
  const screen = mount()
  assert.equal(screen.values.reaction, "dislike")
  assert.equal(screen.values.content, "Private prefilled account A review")
  screen.submit()
  screen.upload.resolve(screen.uploads[0].payload)
  await until(() => screen.requests.length === 1)
  assert.equal(screen.requests[0].payload.get("remove_image"), "0")
  assert.equal(screen.requests[0].token, "account-a")
  screen.response.resolve({ success: true, message: "Saved" })
  await screen.pending
  assert.equal(screen.resets.length, 1)
  assert.equal(screen.resets[0].content, "Private prefilled account A review")
  assert.deepEqual(screen.toasts, [["success", "Saved"]])
  assert.deepEqual(screen.errors, [])
})
