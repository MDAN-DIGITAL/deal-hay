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

test("product gallery prioritizes only the selected full-size image", async () => {
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
  `)
  const galleryState = await import(galleryWidgets)
  const { ProductGallery } = await import(
    transpile("../src/modules/public/components/product-gallery.tsx", {
      "react/jsx-runtime": jsx,
      react: galleryWidgets,
      "@/components/media-image": galleryWidgets,
      "@/components/ui/button": galleryWidgets,
      "@/components/ui/card": galleryWidgets,
    })
  )
  const props = {
    name: "Điện thoại",
    imageUrl: "primary.webp",
    images: [{ id: "second", image_url: "second.webp" }],
  }
  galleryState.reset()
  let images = nodes(ProductGallery(props)).filter(
    ({ type }) => type === "media-image"
  )

  assert.equal(images.length, 1)
  assert.equal(images[0].props.fetchPriority, "high")
  assert.equal(images[0].props.loading, "eager")
  assert.equal(images[0].props.retryable, true)
  images[0].props.onLoad()

  galleryState.reset()
  images = nodes(ProductGallery(props)).filter(
    ({ type }) => type === "media-image"
  )
  assert.equal(images.length, 3)
  assert.deepEqual(
    images.slice(1).map(({ props }) => props.fetchPriority),
    ["low", "low"]
  )

  galleryState.reset()
  images = nodes(
    ProductGallery({
      ...props,
      imageUrl: "new-primary.webp",
      images: [{ id: "new-second", image_url: "new-second.webp" }],
    })
  ).filter(({ type }) => type === "media-image")
  assert.equal(images.length, 1)
})
