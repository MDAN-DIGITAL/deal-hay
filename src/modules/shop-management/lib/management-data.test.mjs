import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

async function load(name) {
  const source = ts.transpileModule(
    readFileSync(new URL(name, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  )
}
const { filterShopProducts, filterShopOrders, isOpenOrder, isLowStock } =
  await load("./management-data.ts")
const { managementTab, managementHref } = await load(
  "./management-navigation.ts"
)
const products = [
  {
    id: "1",
    name: "Đầm đỏ",
    sku: "SKU-01",
    category: "Thời trang",
    is_active: true,
    stock: 5,
  },
  {
    id: "2",
    name: "Áo sơ mi",
    sku: null,
    category: "Thời trang",
    is_active: false,
    stock: 0,
  },
  {
    id: "3",
    name: "Điện thoại",
    sku: "PHONE",
    category: "Điện tử",
    is_active: true,
    stock: 6,
  },
  {
    id: "4",
    name: "Áo đen",
    sku: "SKU-04",
    category: "Thời trang",
    is_active: true,
    stock: 0,
  },
]
const orders = [
  "pending",
  "confirmed",
  "processing",
  "shipping",
  "completed",
  "cancelled",
].map((status, index) => ({
  id: String(index),
  status,
  order_number: `DH-0${index}`,
  customer_name: "Đặng Ánh",
  customer_phone: "0901234567",
  items: [{ product_name: "Đầm đỏ" }],
}))

test("product search supports Vietnamese without accents, SKU, category and status together", () => {
  assert.deepEqual(
    filterShopProducts(products, "  DAM DO ", "active").map((item) => item.id),
    ["1"]
  )
  assert.deepEqual(
    filterShopProducts(products, "sku-04", "all").map((item) => item.id),
    ["4"]
  )
  assert.deepEqual(
    filterShopProducts(products, "thoi trang", "hidden").map((item) => item.id),
    ["2"]
  )
  assert.deepEqual(filterShopProducts(products, "not-found", "all"), [])
})

test("low-stock tasks include out-of-stock active products and exclude hidden products", () => {
  assert.deepEqual(
    products.filter(isLowStock).map((item) => item.id),
    ["1", "4"]
  )
  assert.deepEqual(
    filterShopProducts(products, "", "low-stock").map((item) => item.id),
    ["1", "4"]
  )
})

test("open orders exclude completed and cancelled orders, and combine with customer/product search", () => {
  assert.equal(orders.filter(isOpenOrder).length, 4)
  for (const query of ["dang anh", "0901234567", "dam do"]) {
    assert.equal(filterShopOrders(orders, query, "open").length, 4)
  }
  assert.deepEqual(
    filterShopOrders(orders, "dh-04", "completed").map((item) => item.id),
    ["4"]
  )
  assert.deepEqual(filterShopOrders(orders, "dh-04", "pending"), [])
})

test("management URLs round trip every section and default invalid tabs to overview", () => {
  for (const tab of [
    "overview",
    "orders",
    "products",
    "inventory",
    "promotions",
    "reviews",
    "settings",
  ]) {
    const url = new URL(managementHref(tab), "https://example.test")
    assert.equal(managementTab(url.searchParams.get("tab") ?? undefined), tab)
  }
  assert.equal(managementTab("unknown"), "overview")
  assert.equal(managementTab(), "overview")
})
