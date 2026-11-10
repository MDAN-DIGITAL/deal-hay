import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8")

test("the storefront hero explains the optional advertising offer flow", () => {
  const source = readSource(
    "../src/modules/public/containers/home-page-container.tsx"
  )

  assert.match(source, /Mua sắm thông minh, tiết kiệm hơn/)
  assert.match(
    source,
    /Xem quảng cáo tự nguyện để mở khóa giá ưu đãi từ người bán\./
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
  assert.match(source, /Xem quảng cáo\s+là\s+tùy\s+chọn\./)
})

test("the footer contains dedicated customer and seller navigation", () => {
  const source = readSource("../src/components/layout/site-footer.tsx")

  assert.match(source, /Dành cho khách hàng/)
  assert.match(source, /Chính sách ưu đãi quảng cáo/)
  assert.match(source, /Chính sách đổi trả/)
  assert.match(source, /Dành cho người bán/)
  assert.match(source, /Chính sách giá/)
  assert.match(source, /Chính sách phí 0%/)
  assert.match(source, /Quy chế hoạt động/)
})
