import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

function load(path, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }
  )
  const text = outputText.replace(/from "([^"]+)"/g, (_, module) => {
    assert.ok(imports[module], module)
    return `from "${imports[module]}"`
  })
  return `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`
}

const modelUrl = load("../src/modules/cart/lib/cart.ts")
const { cartAvailability, parseCartQuantity, readCartLines } = await import(
  modelUrl
)
const { addCartItem, removeCartItem } = await import(
  load("../src/modules/cart/lib/cart-store.ts", {
    "./cart": modelUrl,
    react: import.meta.resolve("react"),
  })
)
const variant = (id, stock, active = true) => ({
  id,
  stock,
  is_active: active,
  sku: id,
  option_values: { "Bảo hành": id },
})
const product = (stock, ...variants) => ({
  id: "phone",
  slug: "dien-thoai",
  name: "Điện thoại",
  stock,
  price: 100,
  has_variants: variants.length > 0,
  variants,
})
const line = (variantId, quantity) => ({
  productId: "phone",
  productSlug: "dien-thoai",
  productName: "Điện thoại",
  shopCode: "SHOP",
  shopName: "Shop",
  variantId,
  variantLabel: variantId ?? "",
  quantity,
})

test("two warranty options cannot each claim the same phone from a shared stock pool", () => {
  const phone = product(1, variant("6 tháng", 1), variant("12 tháng", 1))
  const lines = [line("6 tháng", 1)]
  assert.equal(cartAvailability(phone, "6 tháng", lines).remaining, 0)
  assert.equal(cartAvailability(phone, "12 tháng", lines).maxQuantity, 0)
})

test("individual SKU caps apply even when the product still has other units in stock", () => {
  const phone = product(6, variant("6 tháng", 2), variant("12 tháng", 4))
  const lines = [line("6 tháng", 2), line("12 tháng", 3)]
  assert.equal(cartAvailability(phone, "6 tháng", lines).remaining, 0)
  assert.equal(cartAvailability(phone, "12 tháng", lines).remaining, 1)
})

test("retired variants do not consume stock and reduced stock blocks additional items", () => {
  const phone = product(2, variant("6 tháng", 1, false), variant("12 tháng", 2))
  const lines = [line("6 tháng", 1), line("12 tháng", 3)]
  assert.equal(cartAvailability(phone, "6 tháng", lines), null)
  assert.equal(cartAvailability(phone, "12 tháng", lines).maxQuantity, 2)
  assert.equal(cartAvailability(phone, "12 tháng", lines).remaining, 0)
  assert.equal(cartAvailability(phone, null, lines), null)
})

test("cart quantities are validated when restoring the browser cart or following a checkout link", () => {
  assert.deepEqual(
    readCartLines(JSON.stringify([line(null, 0), line(null, 2)])),
    [line(null, 2)]
  )
  assert.deepEqual(readCartLines("not JSON"), [])
  assert.equal(parseCartQuantity("9999"), 9999)
  for (const invalid of ["0", "10000", "1e2", "1.5", "2,3", undefined])
    assert.equal(parseCartQuantity(invalid), undefined)
})

test("concurrent adds read the latest cart and a partial purchase removes only the purchased quantity", async () => {
  const data = new Map()
  const mockWindow = new EventTarget()
  mockWindow.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  }
  globalThis.window = mockWindow
  try {
    const snapshot = {
      product: product(2, variant("6 tháng", 2), variant("12 tháng", 2)),
      shop: { code: "SHOP", name: "Shop" },
    }
    await Promise.all([
      addCartItem(snapshot, "6 tháng", "phone"),
      addCartItem(snapshot, "6 tháng", "phone"),
    ])
    await assert.rejects(
      addCartItem(snapshot, "12 tháng", "phone"),
      /đạt số lượng/
    )
    await removeCartItem({ productId: "phone", variantId: "6 tháng" }, 1)
    await addCartItem(snapshot, "12 tháng", "phone")
    const saved = readCartLines([...data.values()][0])
    assert.deepEqual(
      saved.map(({ variantId, quantity }) => [variantId, quantity]),
      [
        ["6 tháng", 1],
        ["12 tháng", 1],
      ]
    )
  } finally {
    delete globalThis.window
  }
})
