import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const jsx = moduleUrl(`
  export const Fragment="fragment"
  export const jsx=(type,props,key)=>({type,props,key})
  export const jsxs=jsx
`)
function transpile(path, imports) {
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
const state = moduleUrl(`
  let cursor=0
  export const reset=()=>{cursor=0}
  export const clear=()=>{globalThis.__mediaImageState=[];cursor=0}
  export const useState=(initial)=>{
    const index=cursor++
    const states=globalThis.__mediaImageState??=[]
    if (!(index in states)) states[index]=typeof initial==="function"?initial():initial
    return [states[index],(next)=>{states[index]=typeof next==="function"?next(states[index]):next}]
  }
`)
const widgets = moduleUrl(`
  export default "next-image"
  export const RotateCwIcon="icon"
  export const ImageIcon="image-icon"
  export const env={API_URL:"https://api.example.test/api"}
  export const apiAssetUrl=(value)=>value||undefined
  export const isPublicMediaAssetUrl=(value,apiUrl)=>value.startsWith(apiUrl+"/media/assets/")
  export const Button="button"
  export const cn=(...values)=>values.flat().filter(Boolean).join(" ")
`)
const stateModule = await import(state)
const { MediaImage } = await import(
  transpile("../src/components/media-image.tsx", {
    "react/jsx-runtime": jsx,
    react: state,
    "next/image": widgets,
    "lucide-react": widgets,
    "@/components/ui/button": widgets,
    "@/config/env": widgets,
    "@/lib/public-media-url": widgets,
    "@/lib/utils": widgets,
  })
)
function nodes(node) {
  if (!node || typeof node !== "object") return []
  return [
    node,
    ...[]
      .concat(node.props?.children ?? [])
      .flat(Infinity)
      .flatMap(nodes),
  ]
}
function renderImage(props = {}) {
  stateModule.reset()
  return MediaImage({
    alt: "Ảnh sản phẩm",
    src: "https://api.example.test/api/media/assets/product.webp",
    ...props,
  })
}

test("media images expose a stable loading state, priority and local retry", () => {
  stateModule.clear()
  let tree = renderImage({ fetchPriority: "high", retryable: true })
  let image = nodes(tree).find(({ type }) => type === "next-image")
  assert.equal(tree.props["data-image-state"], "loading")
  assert.equal(image.props.fetchPriority, "high")
  assert.equal(image.props.decoding, "async")
  assert.equal(image.props.unoptimized, false)
  assert.match(image.props.className, /opacity-0/)

  image.props.onLoad()
  tree = renderImage({ fetchPriority: "high", retryable: true })
  image = nodes(tree).find(({ type }) => type === "next-image")
  assert.equal(tree.props["data-image-state"], "ready")
  assert.match(image.props.className, /opacity-100/)

  image.props.onError()
  tree = renderImage({ fetchPriority: "high", retryable: true })
  const retry = nodes(tree).find(
    ({ type, props }) =>
      type === "button" && props.children === "Thử tải lại ảnh"
  )
  assert.equal(tree.props["data-image-state"], "error")
  assert.ok(retry)

  retry.props.onClick()
  tree = renderImage({ fetchPriority: "high", retryable: true })
  image = nodes(tree).find(({ type }) => type === "next-image")
  assert.equal(tree.props["data-image-state"], "loading")
  assert.match(String(image.key), /:1$/)
})

test("media images only optimize public API assets and forward onLoad", () => {
  stateModule.clear()
  let loaded = 0
  let tree = renderImage({ onLoad: () => loaded++ })
  let image = nodes(tree).find(({ type }) => type === "next-image")
  image.props.onLoad()
  assert.equal(loaded, 1)

  stateModule.clear()
  tree = renderImage({ src: "https://images.example.test/product.webp" })
  image = nodes(tree).find(({ type }) => type === "next-image")
  assert.equal(image.props.unoptimized, true)

  stateModule.clear()
  tree = renderImage({ src: "blob:https://dealhay.example/preview" })
  image = nodes(tree).find(({ type }) => type === "next-image")
  assert.equal(image.props.unoptimized, true)
})

test("product gallery keeps detail images reachable before the primary image succeeds", async () => {
  const galleryWidgets = moduleUrl(`
    let cursor=0
    const states=[]
    export const reset=()=>{cursor=0}
    export const useMemo=(read)=>read()
    export const useState=(initial)=>{
      const index=cursor++
      if (!(index in states)) states[index]=typeof initial==="function"?initial():initial
      return [states[index],(next)=>{states[index]=typeof next==="function"?next(states[index]):next}]
    }
    export const MediaImage="media-image"
    export const Button="button",Card="card",CardContent="card-content"
    export const Dialog="dialog",DialogContent="dialog-content",DialogDescription="dialog-description",DialogTitle="dialog-title",DialogTrigger="dialog-trigger"
    export const ChevronLeftIcon="icon",ChevronRightIcon="icon",ZoomInIcon="icon"
  `)
  const galleryState = await import(galleryWidgets)
  const { ProductGallery } = await import(
    transpile("../src/modules/public/components/product-gallery.tsx", {
      "react/jsx-runtime": jsx,
      react: galleryWidgets,
      "@/components/media-image": galleryWidgets,
      "@/components/ui/button": galleryWidgets,
      "@/components/ui/card": galleryWidgets,
      "@/components/ui/dialog": galleryWidgets,
      "lucide-react": galleryWidgets,
    })
  )
  const props = {
    name: "Điện thoại",
    imageUrl: "primary.webp",
    images: [{ id: "second", image_url: "second.webp" }],
  }
  const render = (values = props) => {
    galleryState.reset()
    return ProductGallery(values)
  }
  let tree = render()
  const mainImage = (tree) =>
    nodes(tree).find(
      ({ type, props }) =>
        type === "media-image" && props.fetchPriority === "high"
    )
  const thumbnails = (tree) =>
    nodes(tree).filter(
      ({ type, props }) =>
        type === "media-image" && props.fetchPriority === "low"
    )
  const button = (tree, label) =>
    nodes(tree).find(
      ({ type, props }) => type === "button" && props["aria-label"] === label
    )
  assert.equal(mainImage(tree).props.loading, "eager")
  assert.equal(mainImage(tree).props.retryable, true)
  assert.equal(mainImage(tree).props.imageClassName, "object-contain")
  assert.equal(mainImage(tree).props.src, "primary.webp")
  assert.deepEqual(
    thumbnails(tree).map(({ props }) => props.src),
    ["primary.webp", "second.webp"]
  )

  // Selecting another image never waits for the cover's onLoad: a failed cover
  // must not trap the user away from otherwise valid detail photos.
  button(tree, "Xem ảnh 2 của Điện thoại").props.onClick()
  tree = render()
  assert.equal(mainImage(tree).props.src, "second.webp")
  assert.equal(
    button(tree, "Xem ảnh 2 của Điện thoại").props["aria-pressed"],
    true
  )
  button(tree, "Ảnh sản phẩm tiếp theo").props.onClick()
  tree = render()
  assert.equal(
    mainImage(tree).props.src,
    "primary.webp",
    "next wraps to the cover"
  )
  const dialog = nodes(tree).find(({ type }) => type === "dialog-content")
  let prevented = false
  dialog.props.onKeyDown({
    key: "ArrowLeft",
    preventDefault() {
      prevented = true
    },
  })
  tree = render()
  assert.equal(prevented, true)
  assert.equal(
    mainImage(tree).props.src,
    "second.webp",
    "left arrow wraps to the last detail photo"
  )
  assert.ok(nodes(tree).find(({ type }) => type === "dialog-trigger"))

  tree = render({
    ...props,
    imageUrl: "new-primary.webp",
    images: [
      { id: "duplicate", image_url: " new-primary.webp " },
      { id: "empty", image_url: " " },
      { id: "new-second", image_url: "new-second.webp" },
    ],
  })
  assert.equal(mainImage(tree).props.src, "new-primary.webp")
  assert.deepEqual(
    thumbnails(tree).map(({ props }) => props.src),
    ["new-primary.webp", "new-second.webp"]
  )
  assert.ok(
    nodes(tree).find(({ props }) =>
      props.className?.includes("overflow-x-auto")
    )
  )
})
