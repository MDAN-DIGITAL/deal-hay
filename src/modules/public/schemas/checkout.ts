import { z } from "zod"

import { phoneNumberRegex } from "@/lib/validation"

export const checkoutSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên người nhận.")
    .max(120, "Tên người nhận không được vượt quá 120 ký tự."),
  customer_phone: z
    .string()
    .trim()
    .regex(phoneNumberRegex, "Vui lòng nhập số điện thoại Việt Nam hợp lệ."),
  shipping_address: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập số nhà, tên đường.")
    .max(500, "Địa chỉ giao hàng không được vượt quá 500 ký tự."),
  shipping_province_code: z.string().min(1, "Vui lòng chọn tỉnh thành."),
  shipping_ward_code: z.string().min(1, "Vui lòng chọn phường xã."),
  quoted_shipping_fee: z.number().int().min(0).max(999999999).optional(),
  shipping_discount_code: z
    .string()
    .trim()
    .toUpperCase()
    .length(32, "Mã miễn phí vận chuyển không hợp lệ.")
    .optional(),
  quantity: z
    .number()
    .int("Số lượng phải là số nguyên.")
    .min(1, "Số lượng phải từ 1 trở lên.")
    .max(9999, "Số lượng không được vượt quá 9.999 sản phẩm."),
  note: z.string().trim().max(2000, "Ghi chú không được vượt quá 2.000 ký tự."),
})

export type CheckoutValues = z.infer<typeof checkoutSchema>
