"use client"

import { BanknoteIcon, VideoIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FormSubmitButton } from "@/components/form-submit-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProductPricingAction } from "@/modules/shop-management/actions"
import type { ShopProduct } from "@/types/shop"

export function ProductPricingForm({ product }: { product: ShopProduct }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const fields = [
    {
      name: "price",
      label: "Giá bán sản phẩm",
      type: "number",
      value: product.price,
      min: 1000,
      max: 999999999,
      required: true,
    },
    {
      name: "old_price",
      label: "Giá gốc (tùy chọn)",
      type: "number",
      value: product.old_price ?? "",
      min: 1000,
      max: 999999999,
    },
    {
      name: "video_url",
      label: "URL video sản phẩm (HTTPS)",
      type: "url",
      value: product.video_url ?? "",
    },
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value)
          setErrors({})
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            className="w-full"
            size="sm"
            variant="outline"
            startIcon={<BanknoteIcon />}
          />
        }
      >
        Giá và ưu đãi
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Giá và ưu đãi sản phẩm</DialogTitle>
          <DialogDescription>
            {product.name}. Cập nhật giá bán, giá gốc tùy chọn và video giới
            thiệu sản phẩm.
          </DialogDescription>
        </DialogHeader>
        <form
          key={`${product.id}:${product.price}:${product.old_price}:${product.video_url}`}
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            const data = new FormData(event.currentTarget)
            setErrors({})
            startTransition(async () => {
              const state = await updateProductPricingAction(product.id, data)
              if (!state.success) {
                setErrors(state.errors ?? {})
                toast.error(state.message)
                return
              }
              toast.success(state.message)
              setOpen(false)
            })
          }}
        >
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={`${product.id}-${field.name}`}>
                {field.label}
              </Label>
              <Input
                startIcon={
                  field.type === "url" ? <VideoIcon /> : <BanknoteIcon />
                }
                id={`${product.id}-${field.name}`}
                name={field.name}
                type={field.type}
                defaultValue={field.value}
                min={field.min}
                max={field.max}
                required={field.required}
                disabled={pending}
                aria-invalid={Boolean(errors[field.name])}
                aria-describedby={
                  errors[field.name]
                    ? `${product.id}-${field.name}-error`
                    : undefined
                }
              />
              {errors[field.name]?.[0] && (
                <p
                  className="text-sm text-destructive"
                  id={`${product.id}-${field.name}-error`}
                  role="alert"
                >
                  {errors[field.name][0]}
                </p>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Giá bán là giá mua ngay. Ưu đãi được áp dụng theo mã giảm giá hợp
            lệ. Giá gốc chỉ để so sánh và phải cao hơn giá bán. Video giới thiệu
            sản phẩm là tùy chọn.
          </p>
          <FormSubmitButton
            className="w-full"
            idleText="Lưu giá và ưu đãi"
            pending={pending}
            pendingText="Đang lưu..."
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
