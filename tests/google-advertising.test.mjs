import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const exists = (path) => existsSync(new URL(path, import.meta.url))
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`

function transpile(path, imports = {}) {
  const { outputText } = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, specifier) => {
      assert.ok(imports[specifier], `Unexpected import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}

const configUrl = transpile("../src/config/advertising.ts")
const config = await import(configUrl)
const adsenseUrl = transpile("../src/lib/google-adsense.ts", {
  "@/config/advertising": configUrl,
})
const { initializeGoogleAdsense } = await import(adsenseUrl)
const hooksUrl = moduleUrl(`
  let slots = [], cursor = 0, effects = []
  export function reset() { slots = []; cursor = 0; effects = [] }
  export function beginRender() { cursor = 0; effects = [] }
  export function flushEffects() { for (const effect of effects) effect() }
  export function cleanupEffects() { for (const slot of slots) slot?.cleanup?.() }
  export function useState(initial) {
    const index = cursor++
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
    return [slots[index], (next) => {
      slots[index] = typeof next === "function" ? next(slots[index]) : next
    }]
  }
  export function useRef(initial) {
    const index = cursor++
    if (!(index in slots)) slots[index] = { current: initial }
    return slots[index]
  }
  export function useEffect(effect, dependencies) {
    const index = cursor++
    const previous = slots[index]
    if (!previous || !dependencies || dependencies.some((value, index) => !Object.is(value, previous.dependencies[index]))) {
      effects.push(() => {
        previous?.cleanup?.()
        slots[index] = { dependencies, cleanup: effect() }
      })
    }
  }
  export const useLayoutEffect = useEffect
  export function useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot() }
`)
const hooks = await import(hooksUrl)
const { StorefrontAdvertising } = await import(
  transpile("../src/components/storefront-advertising.tsx", {
    react: hooksUrl,
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "next/link": moduleUrl('export default "a"'),
    "@/components/ui/button": moduleUrl('export const Button = "button"'),
    "@/components/ui/surface": moduleUrl('export const Surface = "section"'),
    "@/hooks/use-advertising-content": transpile(
      "../src/hooks/use-advertising-content.ts",
      { react: hooksUrl }
    ),
    "@/lib/google-adsense": adsenseUrl,
  })
)
// A small document model verifies observable insertion behavior without
// downloading or executing live advertisements during automated tests.
class Element {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase()
    this.ownerDocument = ownerDocument
    this.children = []
    this.attributes = new Map()
    this.parentNode = null
    this.id = ""
    this.src = ""
    // Browser-created script elements are async by default.
    this.async = tagName === "script"
  }

  get parentElement() {
    return this.parentNode
  }

  get isConnected() {
    return (
      this === this.ownerDocument.documentElement ||
      Boolean(this.parentNode?.isConnected)
    )
  }

  get nextSibling() {
    const siblings = this.parentNode?.children || []
    return siblings[siblings.indexOf(this) + 1] || null
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value))
    if (name === "id" || name === "src") this[name] = String(value)
    if (name === "async") this.async = true
  }

  getAttribute(name) {
    if (name === "id" || name === "src") return this[name] || null
    return this.attributes.get(name) ?? null
  }

  appendChild(child) {
    return this.insertBefore(child, null)
  }

  append(...children) {
    for (const child of children) this.appendChild(child)
  }

  insertBefore(child, reference) {
    child.remove()
    const index =
      reference === null
        ? this.children.length
        : this.children.indexOf(reference)
    assert.notEqual(index, -1, "insertion reference belongs to its parent")
    this.children.splice(index, 0, child)
    child.parentNode = this
    return child
  }

  before(child) {
    this.parentNode.insertBefore(child, this)
  }

  remove() {
    if (!this.parentNode) return
    const siblings = this.parentNode.children
    siblings.splice(siblings.indexOf(this), 1)
    this.parentNode = null
  }

  querySelector() {
    return (
      this.ownerDocument
        .elements(this)
        .slice(1)
        .find((element) =>
          element.tagName === "IFRAME" || element.tagName === "IMG"
            ? Boolean(element.getAttribute("src"))
            : element.tagName === "A" && Boolean(element.getAttribute("href"))
        ) || null
    )
  }
}

class Events {
  listeners = new Map()

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(callback)
  }

  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback)
  }

  dispatchEvent(event) {
    for (const callback of this.listeners.get(event.type) || []) callback(event)
  }
}

class Document extends Events {
  constructor() {
    super()
    this.documentElement = new Element("html", this)
    this.head = new Element("head", this)
    this.body = new Element("body", this)
    this.documentElement.append(this.head, this.body)
    this.cookie = ""
    this.visibilityState = "visible"
    this.adEligible = true
  }

  createElement(tagName) {
    return new Element(tagName, this)
  }

  querySelector(selector) {
    assert.equal(selector, 'main [data-ad-eligible="true"]')
    return this.adEligible ? this.body : null
  }

  getElementById(id) {
    return this.elements().find((element) => element.id === id) || null
  }

  elements(root = this.documentElement) {
    return [root, ...root.children.flatMap((child) => this.elements(child))]
  }

  get scripts() {
    return this.elements().filter((element) => element.tagName === "SCRIPT")
  }
}

function withDocument(document, callback) {
  const previous = globalThis.document
  globalThis.document = document
  try {
    return callback()
  } finally {
    if (previous === undefined) delete globalThis.document
    else globalThis.document = previous
  }
}

function advertisingComponent(options = {}) {
  hooks.reset()
  const document = new Document()
  document.adEligible = options.eligible ?? true
  document.cookie = options.cookie ?? ""
  let reloads = 0,
    tree
  const window = Object.assign(new Events(), {
    location: {
      protocol: "https:",
      pathname: options.pathname ?? "/",
      reload: () => {
        reloads++
      },
    },
  })
  function inBrowser(callback) {
    const previous = globalThis.window
    globalThis.window = window
    try {
      return withDocument(document, callback)
    } finally {
      if (previous === undefined) delete globalThis.window
      else globalThis.window = previous
    }
  }
  function render() {
    return inBrowser(() => {
      hooks.beginRender()
      tree = StorefrontAdvertising()
      hooks.flushEffects()
      return tree
    })
  }
  render()
  return {
    document,
    render,
    dispatch: (type) => inBrowser(() => window.dispatchEvent({ type })),
    unmount: () => inBrowser(() => hooks.cleanupEffects()),
    get tree() {
      return tree
    },
    get reloads() {
      return reloads
    },
  }
}

test("uses the supplied Google publisher account and official script URLs", () => {
  assert.equal(config.GOOGLE_ADSENSE_CLIENT, "ca-pub-7303400269186048")
  assert.equal(
    config.GOOGLE_ADSENSE_SCRIPT_URL,
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7303400269186048"
  )
  assert.equal(
    config.GOOGLE_PUBLISHER_TAG_SCRIPT_URL,
    "https://securepubads.g.doubleclick.net/tag/js/gpt.js"
  )
})

test("initializes the supplied async AdSense script with anonymous crossorigin", () => {
  const document = new Document()
  initializeGoogleAdsense(document)
  assert.equal(document.scripts.length, 1)
  const [script] = document.scripts
  assert.equal(script.id, "google-adsense")
  assert.equal(script.src, config.GOOGLE_ADSENSE_SCRIPT_URL)
  assert.equal(script.async, true)
  assert.equal(script.crossOrigin, "anonymous")
  assert.equal(script.parentElement, document.head)
})

test("repeated initialization and an existing publisher snippet never duplicate AdSense", () => {
  const document = new Document()
  initializeGoogleAdsense(document)
  const [script] = document.scripts
  initializeGoogleAdsense(document)
  initializeGoogleAdsense(document)
  assert.deepEqual(document.scripts, [script])

  const existingDocument = new Document()
  const existingScript = existingDocument.createElement("script")
  existingScript.src = config.GOOGLE_ADSENSE_SCRIPT_URL
  existingDocument.head.appendChild(existingScript)
  initializeGoogleAdsense(existingDocument)
  assert.deepEqual(existingDocument.scripts, [existingScript])
})

test("a fresh storefront document initializes its own publisher script", () => {
  for (let index = 0; index < 2; index += 1) {
    const document = new Document()
    initializeGoogleAdsense(document)
    assert.equal(document.scripts.length, 1)
  }
})

test("advertising starts automatically on eligible content without a cookie prompt", () => {
  const component = advertisingComponent()
  assert.equal(component.document.scripts.length, 1)
  assert.equal(
    component.document.cookie,
    "",
    "loading the page does not write a user consent record"
  )
  assert.equal(component.tree, null)
  component.render()
  assert.equal(component.document.scripts.length, 1)
})

test("legacy cookie choices do not block the new default or cause reloads", () => {
  for (const cookie of [
    "deal-hay-advertising-consent=v2:accepted",
    "deal-hay-advertising-consent=v2:declined",
    "deal-hay-advertising-consent=garbage",
  ]) {
    const component = advertisingComponent({ cookie })
    assert.equal(component.document.scripts.length, 1)
    assert.equal(component.document.cookie, cookie)
    assert.equal(component.tree, null)
    for (const event of ["focus", "pageshow"]) component.dispatch(event)
    component.render()
    assert.equal(component.reloads, 0)
    assert.equal(component.document.scripts.length, 1)
    component.unmount()
  }
})

test("empty, loading and failed content cannot start ads; recovered content starts once", () => {
  const component = advertisingComponent({ eligible: false })
  assert.equal(component.document.scripts.length, 0)
  assert.equal(component.tree, null)
  component.document.adEligible = true
  component.render()
  assert.equal(component.document.scripts.length, 1)
  component.document.adEligible = false
  component.render()
  component.document.adEligible = true
  component.render()
  assert.equal(component.document.scripts.length, 1)
})

test("checkout and account routes cannot initialize publisher ads even with a catalog marker", () => {
  for (const pathname of [
    "/sign-in",
    "/profile",
    "/chats",
    "/chats/example",
    "/admin/users",
    "/shops/SHOP/products/product/checkout",
  ]) {
    const component = advertisingComponent({ pathname })
    assert.equal(component.document.scripts.length, 0, pathname)
    assert.equal(component.tree, null, pathname)
  }
})

test("private routes use a separate document root so loaded provider code cannot survive navigation", () => {
  assert.equal(
    exists("../src/app/layout.tsx"),
    false,
    "a common root would preserve third-party document listeners"
  )
  const storefront = read("../src/app/(storefront)/layout.tsx")
  const application = read("../src/app/(application)/layout.tsx")
  const document = read("../src/components/layout/site-document.tsx")
  assert.match(storefront, /StorefrontAdvertising/)
  assert.doesNotMatch(
    application,
    /StorefrontAdvertising|initializeGoogleAdsense|google-adsense|gpt\.js/i
  )
  assert.doesNotMatch(document, /StorefrontAdvertising|initializeGoogleAdsense/)
  assert.ok(exists("../src/app/(storefront)/page.tsx"))
  assert.ok(exists("../src/app/(storefront)/shops/[shopUserCode]/page.tsx"))
  assert.ok(
    exists(
      "../src/app/(storefront)/shops/[shopUserCode]/products/[productSlug]/page.tsx"
    )
  )
  for (const route of [
    "sign-in",
    "sign-up",
    "profile",
    "chats",
    "notifications",
    "discount-codes",
    "admin/users",
    "shop-manage",
    "sell",
    "privacy",
    "terms",
    "shops/[shopUserCode]/products/[productSlug]/checkout",
  ]) {
    assert.ok(exists(`../src/app/(application)/${route}/page.tsx`), route)
  }
  assert.equal(
    exists(
      "../src/app/(storefront)/shops/[shopUserCode]/products/[productSlug]/checkout/page.tsx"
    ),
    false
  )
  assert.match(read("../next.config.ts"), /globalNotFound:\s*true/)
  assert.ok(exists("../src/app/global-not-found.tsx"))
})

test("publishes the supplied ads.txt authorization and account metadata", () => {
  assert.equal(
    read("../public/ads.txt"),
    "google.com, pub-7303400269186048, DIRECT, f08c47fec0942fa0\n"
  )
  const document = read("../src/components/layout/site-document.tsx")
  assert.match(document, /"google-adsense-account": GOOGLE_ADSENSE_CLIENT/)
  assert.equal(exists("../src/lib/adsterra.ts"), false)
  for (const path of [
    "../src/config/advertising.ts",
    "../src/components/storefront-advertising.tsx",
    "../src/app/(application)/privacy/page.tsx",
    "../src/app/(application)/terms/page.tsx",
  ]) {
    assert.doesNotMatch(
      read(path),
      /adsterra|bauval\.org|abscloud\.org|pub-8299349376566920/i,
      path
    )
  }
})

test("the AdSense publisher script never creates or grants rewarded shipping ads", () => {
  for (const path of [
    "../src/lib/google-adsense.ts",
    "../src/components/storefront-advertising.tsx",
  ]) {
    assert.doesNotMatch(
      read(path),
      /adsbygoogle\.push|googletag|rewardedSlotGranted|completeShippingReward/,
      path
    )
  }
})
