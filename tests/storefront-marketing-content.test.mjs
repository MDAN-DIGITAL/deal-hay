import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8")

test("the storefront hero explains shop-funded promotions without advertising rewards", () => {
  const source = readSource(
    "../src/modules/public/containers/home-page-container.tsx"
  )

  assert.match(source, /Mua sắm thông minh, tiết kiệm hơn/)
  assert.match(
    source,
    /Chọn sản phẩm và áp dụng ưu đãi do cửa hàng cung cấp\./
  )
  assert.match(source, /id="cach-thuc-hoat-dong"/)
})

test("products with an offer present separate offer and direct purchase actions", () => {
  const source = readSource(
    "../src/modules/public/components/product-interactions.tsx"
  )

  assert.match(source, /Giá mua ngay/)
  assert.match(source, /Ưu đãi khi thanh toán/)
  assert.match(source, /Mua với ưu đãi/)
  assert.match(source, /Mua ngay/)
  assert.match(source, /productOfferHref/)
  assert.match(source, /Ưu đãi từ shop không yêu cầu xem hoặc nhấp quảng cáo\./)
})

test("the footer contains dedicated customer and seller navigation", () => {
  const source = readSource("../src/components/layout/site-footer.tsx")

  assert.match(source, /Dành cho khách hàng/)
  assert.match(source, /Chính sách ưu đãi từ shop/)
  assert.match(source, /Chính sách đổi trả/)
  assert.match(source, /Dành cho người bán/)
  assert.match(source, /Chính sách giá/)
  assert.match(source, /Chính sách phí 0%/)
  assert.match(source, /Quy chế hoạt động/)
})
