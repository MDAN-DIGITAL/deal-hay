import { z } from "zod"

export const shopCouponSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Nhập tên hiển thị ưu đãi.")
      .max(120, "Tên ưu đãi không được vượt quá 120 ký tự."),
    discount_type: z.enum(["fixed", "percent"], {
      message: "Vui lòng chọn hình thức giảm giá.",
    }),
    discount_value: z
      .number({ error: "Vui lòng nhập mức giảm." })
      .int("Mức giảm phải là số nguyên.")
      .min(1, "Mức giảm phải từ 1 trở lên.")
      .max(999999999, "Mức giảm tối đa là 999.999.999."),
    minimum_order_amount: z
      .number({ error: "Vui lòng nhập giá trị đơn hàng tối thiểu." })
      .int("Giá trị đơn hàng tối thiểu phải là số nguyên.")
      .min(0, "Giá trị đơn hàng tối thiểu không được âm.")
      .max(
        999999999,
        "Giá trị đơn hàng tối thiểu không được vượt quá 999.999.999đ."
      ),
    maximum_discount_amount: z
      .number()
      .int("Số tiền giảm tối đa phải là số nguyên.")
      .min(1, "Số tiền giảm tối đa phải từ 1đ trở lên.")
      .max(999999999, "Số tiền giảm tối đa không được vượt quá 999.999.999đ.")
      .nullable(),
    usage_limit: z
      .number()
      .int("Giới hạn lượt dùng phải là số nguyên.")
      .min(1, "Giới hạn lượt dùng phải từ 1 trở lên.")
      .max(999999, "Giới hạn lượt dùng không được vượt quá 999.999.")
      .nullable(),
    starts_at: z.iso.datetime().nullable(),
    ends_at: z.iso.datetime().nullable(),
    is_active: z.boolean(),
    product_ids: z
      .array(z.uuid())
      .min(1, "Chọn ít nhất một sản phẩm.")
      .max(1000),
  })
  .refine(
    (value) => value.discount_type !== "percent" || value.discount_value <= 100,
    {
      path: ["discount_value"],
      message: "Phần trăm giảm phải từ 1 đến 100.",
    }
  )
  .refine(
    (value) =>
      !value.starts_at ||
      !value.ends_at ||
      new Date(value.ends_at) > new Date(value.starts_at),
    {
      path: ["ends_at"],
      message: "Ngày kết thúc phải sau ngày bắt đầu.",
    }
  )

export type ShopCouponValues = z.infer<typeof shopCouponSchema>
