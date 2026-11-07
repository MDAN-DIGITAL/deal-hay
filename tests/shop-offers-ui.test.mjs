import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const componentPath = new URL(
  "../src/modules/public/components/shop-offers.tsx",
  import.meta.url
)
const componentSource = readFileSync(componentPath, "utf8")
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const stubs = moduleUrl(`
  export default "stub"
  export const ArrowRightIcon="arrow",ChevronDownIcon="chevron",TicketPercentIcon="ticket"
  export const Button="button",Surface="surface",Label="label"
  export const RadioGroup="radio-group",RadioGroupItem="radio-item"
  export const useEffect=()=>{},useId=()=>"id",useState=(value)=>[value,()=>{}]
  export const formatCurrency=String,formatDate=String,cn=(...values)=>values.filter(Boolean).join(" ")
  export const productDetailHref=(shop,slug,{shopCouponCode})=>
    "/shops/"+encodeURIComponent(shop)+"/products/"+encodeURIComponent(slug)+"?"+new URLSearchParams({shop_coupon_code:shopCouponCode})
  export const loadShopOffersAction=async()=>({success:true,data:[]})
  export const shopOfferDiscount=()=>0
`)
const jsx = moduleUrl(`
  export const Fragment="fragment"
  export const jsx=(type,props,key)=>({type,props,key})
  export const jsxs=jsx
`)
const compiled = ts
  .transpileModule(componentSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
    return `from ${quote}${name === "react/jsx-runtime" ? jsx : stubs}${quote}`
  })

const { shopOfferProductHref } = await import(moduleUrl(compiled))

test("shop offer product links safely retain the coupon on the product detail route", () => {
  const href = shopOfferProductHref("SHOP 1", "áo/thun?mới", "SHOP A&B + 20%")
  const url = new URL(href, "https://deal-hay.local")

  assert.equal(
    url.pathname,
    "/shops/SHOP%201/products/%C3%A1o%2Fthun%3Fm%E1%BB%9Bi"
  )
  assert.equal(url.searchParams.get("shop_coupon_code"), "SHOP A&B + 20%")
  assert.equal(url.searchParams.size, 1)
})

test("shop offer cards use multiline product rows and an accessible bounded list", () => {
  assert.match(componentSource, /offer\.products\.slice\(0, 3\)/)
  assert.match(componentSource, /aria-expanded=\{expanded\}/)
  assert.match(componentSource, /line-clamp-2/)
  assert.match(componentSource, /Tự áp dụng khi đặt hàng/)
  assert.doesNotMatch(componentSource, /overflow-[xy]-auto/)
  assert.doesNotMatch(componentSource, /navigator\.clipboard/)
})
