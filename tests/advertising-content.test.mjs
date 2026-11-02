import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const source = ts
  .transpileModule(
    readFileSync(
      new URL("../src/hooks/use-advertising-content.ts", import.meta.url),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  .outputText.replace(
    /from "react"/,
    `from "data:text/javascript,export function useSyncExternalStore(){}"`
  )
const {
  isAdvertisingPage,
  hasAdvertisingContent,
  subscribeAdvertisingContent,
} = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
)

test("publisher ads are limited to public catalog URLs", () => {
  for (const path of [
    "/",
    "/shops/SHOP",
    "/shops/SHOP/",
    "/shops/SHOP/products/product",
    "/shops/SHOP/products/product/",
  ])
    assert.equal(isAdvertisingPage(path), true, path)
  for (const path of [
    "/profile",
    "/chats",
    "/admin/users",
    "/shops/SHOP/products/product/checkout",
    "/shops/SHOP/unknown",
    "/shops",
    "/sign-in",
  ])
    assert.equal(isAdvertisingPage(path), false, path)
})

test("content readiness changes are observed and listeners are disposed on unmount", () => {
  const originals = {
    window: globalThis.window,
    document: globalThis.document,
    MutationObserver: globalThis.MutationObserver,
  }
  const listeners = new Map()
  const observers = []
  let eligible = false,
    changes = 0
  try {
    globalThis.window = {
      location: { pathname: "/shops/SHOP/products/product" },
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name, callback) => {
        if (listeners.get(name) === callback) listeners.delete(name)
      },
    }
    globalThis.document = {
      body: {},
      querySelector: (selector) =>
        selector === 'main [data-ad-eligible="true"]' && eligible ? {} : null,
    }
    globalThis.MutationObserver = class {
      constructor(callback) {
        this.callback = callback
        observers.push(this)
      }
      observe(target, options) {
        assert.equal(target, document.body)
        assert.equal(options.subtree, true)
      }
      disconnect() {
        this.disconnected = true
      }
    }
    const unsubscribe = subscribeAdvertisingContent(() => changes++)
    const observer = observers[0]
    assert.equal(hasAdvertisingContent(), false)
    eligible = true
    observer.callback()
    assert.equal(changes, 1)
    assert.equal(hasAdvertisingContent(), true)
    window.location.pathname += "/checkout"
    listeners.get("popstate")()
    assert.equal(changes, 2)
    assert.equal(hasAdvertisingContent(), false)
    unsubscribe()
    assert.equal(observer.disconnected, true)
    assert.equal(listeners.size, 0)
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})
