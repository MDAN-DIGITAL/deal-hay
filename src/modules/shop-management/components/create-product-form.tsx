"use client"

import { Surface } from "@/components/ui/surface"

import { useRef, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  PackageIcon,
  TagsIcon,
  BanknoteIcon,
  VideoIcon,
  TagIcon,
  ImageIcon,
  ImagesIcon,
  BoxesIcon,
  ListTreeIcon,
  ListIcon,
  StarIcon,
  PackagePlusIcon,
  ImagePlusIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
} from "react-hook-form"
import { toast } from "sonner"

import { FormSelect } from "@/components/form-select"
import { FormSubmitButton } from "@/components/form-submit-button"
import { SelectedFilePreview } from "@/components/selected-file-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { applyServerErrors, runUploadAction } from "@/lib/form-utils"
import { prepareBrowserImage } from "@/lib/browser-image"
import { serializeProductDescription } from "@/lib/product-description"
import { PRODUCT_GALLERY_LIMIT } from "@/lib/validation"
import { ImageUploadProgress } from "@/components/image-upload-progress"
import { useImageUpload } from "@/hooks/use-image-upload"
import type { ShopCategory } from "@/types/shop"
import { createProductAction } from "@/modules/shop-management/actions"
import { discardProductImageUploadsAction } from "@/modules/media/actions"
import {
  buildProductVariants,
  productFormErrors,
  validateProductOptions,
  variantsMatchOptions,
} from "@/modules/shop-management/lib/product-variants"
import {
  createProductSchema,
  productGallerySchema,
  type CreateProductValues,
} from "@/modules/shop-management/schemas/shop-management"

const ProductDescriptionEditor = dynamic(
  () =>
    import("./product-description-editor").then(
      (module) => module.ProductDescriptionEditor
    ),
  { loading: () => <Skeleton className="h-48 w-full" /> }
)

function initialProductValues(categories: ShopCategory[]): CreateProductValues {
  return {
    name: "",
    category: categories[0]?.name ?? "",
    price: 1000,
    old_price: "",
    video_url: "",
    stock: 0,
    label: "",
    description: "",
    description_content: "",
    image: undefined as unknown as File,
    gallery_images: [],
    has_variants: false,
    options: [],
    variants: [],
  }
}

function numericValue(value: string): number {
  return value === "" ? Number.NaN : Number(value)
}

function optionalNumericValue(value: string): number | "" {
  return value === "" ? "" : Number(value)
}

function fieldErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  if ("message" in error && typeof error.message === "string")
    return error.message
  for (const [key, value] of Object.entries(error)) {
    if (key === "ref") continue
    const message = fieldErrorMessage(value)
    if (message) return message
  }
  return undefined
}

function arrayErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  if ("message" in error && typeof error.message === "string")
    return error.message
  return "root" in error ? fieldErrorMessage(error.root) : undefined
}

function variantLabel(values: Record<string, string>): string {
  return Object.values(values).filter(Boolean).join(" · ") || "Biến thể"
}

export function CreateProductForm({
  categories,
}: {
  categories: ShopCategory[]
}) {
  const [isPending, startTransition] = useTransition()
  const [preparingImages, setPreparingImages] = useState(false)
  const [descriptionVersion, setDescriptionVersion] = useState(0)
  const selectingImages = useRef(false)
  const { prepareUploads, uploadProgress } = useImageUpload()
  const form = useForm<CreateProductValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: initialProductValues(categories),
  })
  const optionFields = useFieldArray({
    control: form.control,
    name: "options",
  })
  const variantFields = useFieldArray({
    control: form.control,
    name: "variants",
  })
  const hasVariants = useWatch({
    control: form.control,
    name: "has_variants",
  })
  const variants = useWatch({ control: form.control, name: "variants" }) ?? []
  const primary = useWatch({ control: form.control, name: "image" })
  const gallery = useWatch({ control: form.control, name: "gallery_images" })
  const imageFieldsLocked = preparingImages || isPending

  async function selectProductImages(
    files: File[],
    field: "image" | "gallery_images",
    onPrepared?: (image: File) => void
  ) {
    if (!files.length || selectingImages.current || isPending) return
    if (field === "gallery_images") {
      const selection = productGallerySchema.safeParse([
        ...form.getValues(field),
        ...files,
      ])
      if (!selection.success) {
        form.setError(field, {
          type: "manual",
          message: selection.error.issues[0]?.message,
        })
        return
      }
    }

    selectingImages.current = true
    setPreparingImages(true)
    const prepared: File[] = []
    try {
      for (const file of files) {
        try {
          prepared.push(await prepareBrowserImage(file, "product"))
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Không thể xử lý ảnh."
          throw new Error(`${file.name}: ${message}`)
        }
      }

      if (field === "image") {
        form.setValue(field, prepared[0], { shouldDirty: true })
      } else {
        form.setValue(field, [...form.getValues(field), ...prepared], {
          shouldDirty: true,
        })
      }
      form.clearErrors(field)
      onPrepared?.(prepared[0])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể xử lý ảnh."
      form.setError(field, { type: "manual", message })
      if (onPrepared) toast.error(message)
    } finally {
      selectingImages.current = false
      setPreparingImages(false)
    }
  }

  const options = useWatch({ control: form.control, name: "options" }) ?? []
  const catalog = validateProductOptions(options)
  const variantsNeedUpdate =
    hasVariants &&
    variants.length > 0 &&
    (!catalog.success ||
      !variantsMatchOptions(
        catalog.options,
        catalog.combinationCount,
        variants
      ))
  const optionsError = arrayErrorMessage(form.formState.errors.options)
  const variantsError = arrayErrorMessage(form.formState.errors.variants)

  const buildVariants = () => {
    form.clearErrors(["options", "variants"])
    const result = buildProductVariants(
      form.getValues("options"),
      form.getValues("variants")
    )
    if (!result.success) {
      result.issues.forEach((issue) => {
        form.setError(issue.path.join(".") as FieldPath<CreateProductValues>, {
          type: "manual",
          message: issue.message,
        })
      })
      return
    }

    result.options.forEach((option, index) => {
      form.setValue(`options.${index}.name`, option.name, { shouldDirty: true })
      form.setValue(`options.${index}.values`, option.values.join(", "), {
        shouldDirty: true,
      })
    })
    variantFields.replace(result.variants)
    toast.success(`Đã tạo ${result.variants.length} biến thể.`)
  }

  const setDefaultVariant = (selectedIndex: number) => {
    variantFields.fields.forEach((_, index) => {
      form.setValue(`variants.${index}.is_default`, index === selectedIndex, {
        shouldDirty: true,
      })
      if (index === selectedIndex) {
        form.setValue(`variants.${index}.is_active`, true, {
          shouldDirty: true,
        })
      }
    })
    void form.trigger("variants")
  }

  const submitProduct = form.handleSubmit((values) => {
    const formData = new FormData()
    formData.set("name", values.name)
    formData.set("category", values.category)
    formData.set("price", String(values.price))
    formData.set("old_price", String(values.old_price ?? ""))
    formData.set("video_url", values.video_url ?? "")
    formData.set("stock", String(values.stock))
    formData.set("label", values.label ?? "")
    formData.set("description", values.description ?? "")
    const description = serializeProductDescription(
      values.description_content,
      values.image,
      values.gallery_images
    )
    if (description) formData.set("description_content", description)
    formData.set("image", values.image)
    values.gallery_images.forEach((image) => {
      formData.append("gallery_images", image)
    })
    formData.set(
      "catalog",
      JSON.stringify({
        has_variants: values.has_variants,
        options: values.has_variants ? values.options : [],
        variants: values.has_variants ? values.variants : [],
      })
    )

    startTransition(async () => {
      let prepared: FormData | undefined
      const state = await runUploadAction(async () => {
        prepared = await prepareUploads(formData, "product")
        return createProductAction(prepared)
      })
      if (!state.success && prepared) {
        const tokens = [
          prepared.get("primary_image_upload"),
          ...prepared.getAll("gallery_image_uploads"),
        ].filter((token): token is string => typeof token === "string")
        await discardProductImageUploadsAction(tokens)
      }
      const hasFieldErrors = applyServerErrors(
        productFormErrors(state.errors),
        form.setError
      )

      if (state.success) {
        toast.success(state.message)
        form.reset(initialProductValues(categories))
        setDescriptionVersion((version) => version + 1)
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        noValidate
        onSubmit={(event) => {
          if (selectingImages.current || isPending) {
            event.preventDefault()
            return
          }
          void submitProduct(event)
        }}
      >
        {categories.length === 0 ? (
          <Surface
            padding="none"
            variant="danger"
            className="p-3 text-sm text-destructive"
          >
            Chưa có danh mục hoạt động. Vui lòng liên hệ quản trị viên trước khi
            đăng sản phẩm.
          </Surface>
        ) : null}

        <section className="space-y-4" aria-labelledby="product-basic-heading">
          <div>
            <h3 id="product-basic-heading" className="font-medium">
              Thông tin cơ bản
            </h3>
            <p className="text-sm text-muted-foreground">
              Tên, mã quản lý, danh mục và giá bán công khai.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Tên sản phẩm</FormLabel>
                  <FormControl>
                    <Input
                      startIcon={<PackageIcon />}
                      maxLength={255}
                      placeholder="Ví dụ: Điện thoại Galaxy S24 256GB"
                      type="text"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Danh mục</FormLabel>
                  <FormSelect
                    startIcon={<TagsIcon />}
                    disabled={categories.length === 0}
                    ref={field.ref}
                    name={field.name}
                    options={categories.map((category) => ({
                      label: category.name,
                      value: category.name,
                    }))}
                    placeholder="Chọn danh mục"
                    value={field.value}
                    onBlur={field.onBlur}
                    onValueChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giá bán sản phẩm</FormLabel>
                  <FormControl>
                    <Input
                      startIcon={<BanknoteIcon />}
                      min={1000}
                      inputMode="numeric"
                      type="number"
                      {...field}
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onChange={(event) =>
                        field.onChange(numericValue(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Giá mua ngay. Mức giảm thực tế được tính theo mã giảm giá
                    hợp lệ trên giá bán, không tính trên giá gốc.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="old_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giá gốc (tùy chọn)</FormLabel>
                  <FormControl>
                    <Input
                      startIcon={<BanknoteIcon />}
                      {...field}
                      min={1000}
                      type="number"
                      placeholder="Để trống nếu không có giá gốc"
                      onChange={(event) =>
                        field.onChange(optionalNumericValue(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Chỉ dùng để so sánh với giá bán, không dùng để tính tiền.
                    Phải cao hơn giá bán; để trống nếu không có giá gốc.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="video_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL video sản phẩm (HTTPS)</FormLabel>
                  <FormControl>
                    <Input
                      startIcon={<VideoIcon />}
                      {...field}
                      type="url"
                      placeholder="https://.../san-pham.mp4"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Nhãn nổi bật</FormLabel>
                  <FormControl>
                    <Input
                      startIcon={<TagIcon />}
                      maxLength={80}
                      placeholder="Ví dụ: Hàng mới, Bán chạy"
                      type="text"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <Separator />

        <section className="space-y-4" aria-labelledby="product-images-heading">
          <div>
            <h3 id="product-images-heading" className="font-medium">
              Hình ảnh sản phẩm
            </h3>
            <p className="text-sm text-muted-foreground">
              Tải 1 ảnh chính và tối đa {PRODUCT_GALLERY_LIMIT} ảnh phụ từ thiết
              bị.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="image"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Ảnh chính</FormLabel>
                  {value instanceof File ? (
                    <SelectedFilePreview
                      file={value}
                      onRemove={
                        imageFieldsLocked
                          ? undefined
                          : () => onChange(undefined)
                      }
                    />
                  ) : (
                    <FormControl>
                      <Input
                        startIcon={<ImageIcon />}
                        name={field.name}
                        ref={field.ref}
                        type="file"
                        onBlur={field.onBlur}
                        disabled={imageFieldsLocked}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0]
                          event.currentTarget.value = ""
                          if (file) void selectProductImages([file], "image")
                        }}
                      />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gallery_images"
              render={({
                field: { onChange, value, ...field },
                fieldState,
              }) => (
                <FormItem>
                  <FormLabel>Ảnh phụ</FormLabel>
                  {value.length > 0 ? (
                    <div className="grid gap-2">
                      {value.map((file, index) => (
                        <SelectedFilePreview
                          key={`${file.name}-${file.lastModified}-${index}`}
                          compact
                          className="max-w-none"
                          file={file}
                          onRemove={
                            imageFieldsLocked
                              ? undefined
                              : () => {
                                  form.clearErrors("gallery_images")
                                  onChange(
                                    value.filter(
                                      (_, fileIndex) => fileIndex !== index
                                    )
                                  )
                                }
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  <FormControl>
                    <Input
                      startIcon={<ImagesIcon />}
                      multiple
                      name={field.name}
                      ref={field.ref}
                      type="file"
                      onBlur={field.onBlur}
                      disabled={
                        imageFieldsLocked ||
                        value.length >= PRODUCT_GALLERY_LIMIT
                      }
                      onChange={(event) => {
                        const selected = Array.from(
                          event.currentTarget.files ?? []
                        )
                        event.currentTarget.value = ""
                        void selectProductImages(selected, "gallery_images")
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Đã chọn {value.length}/{PRODUCT_GALLERY_LIMIT} ảnh phụ.
                  </FormDescription>
                  <FormMessage>
                    {fieldErrorMessage(fieldState.error)}
                  </FormMessage>
                </FormItem>
              )}
            />
          </div>
          {preparingImages ? (
            <p className="text-sm text-muted-foreground" role="status">
              Đang xử lý ảnh...
            </p>
          ) : null}
        </section>

        <Separator />

        <section className="space-y-4" aria-labelledby="product-detail-heading">
          <div>
            <h3 id="product-detail-heading" className="font-medium">
              Mô tả sản phẩm
            </h3>
            <p className="text-sm text-muted-foreground">
              Nêu rõ tình trạng, thông số, phụ kiện và chính sách liên quan.
            </p>
          </div>
          <FormField
            control={form.control}
            name="description_content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nội dung mô tả</FormLabel>
                <FormControl>
                  <ProductDescriptionEditor
                    key={descriptionVersion}
                    primary={primary}
                    gallery={gallery}
                    canUpload={
                      !primary || gallery.length < PRODUCT_GALLERY_LIMIT
                    }
                    disabled={imageFieldsLocked}
                    onChange={(value) => {
                      form.clearErrors("description_content")
                      field.onChange(value)
                    }}
                    onBlur={field.onBlur}
                    onUpload={(file, insert) => {
                      const fieldName = form.getValues("image")
                        ? "gallery_images"
                        : "image"
                      void selectProductImages([file], fieldName, insert)
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Chèn ảnh chính hoặc ảnh phụ vào nội dung. Ảnh mới tải ở đây
                  cũng tính vào giới hạn ảnh sản phẩm.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <Separator />

        <section className="space-y-4" aria-labelledby="product-stock-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="product-stock-heading" className="font-medium">
                Tồn kho và biến thể
              </h3>
              <p className="text-sm text-muted-foreground">
                Dùng biến thể khi sản phẩm có nhiều màu, kích thước hoặc phiên
                bản. SKU sản phẩm và SKU biến thể được hệ thống tự động tạo.
              </p>
            </div>
            <FormField
              control={form.control}
              name="has_variants"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border px-3 py-2">
                  <FormLabel className="cursor-pointer">
                    Sản phẩm có biến thể
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onBlur={field.onBlur}
                      onCheckedChange={(checked) => {
                        field.onChange(checked)
                        form.clearErrors(["stock", "options", "variants"])
                        if (checked && optionFields.fields.length === 0) {
                          optionFields.append({ name: "", values: "" })
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {!hasVariants ? (
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Tồn kho ban đầu</FormLabel>
                  <FormControl>
                    <Input
                      startIcon={<BoxesIcon />}
                      min={0}
                      inputMode="numeric"
                      type="number"
                      {...field}
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onChange={(event) =>
                        field.onChange(numericValue(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <Surface padding="none" className="space-y-5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Thuộc tính</p>
                  <p className="text-sm text-muted-foreground">
                    Nhập các giá trị cách nhau bằng dấu phẩy.
                  </p>
                </div>
                <Button
                  disabled={optionFields.fields.length >= 3}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => optionFields.append({ name: "", values: "" })}
                >
                  <PlusIcon /> Thêm thuộc tính
                </Button>
              </div>

              <div className="space-y-3">
                {optionFields.fields.map((option, optionIndex) => (
                  <Surface
                    padding="none"
                    variant="muted"
                    key={option.id}
                    className="grid gap-3 p-3 md:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)_auto] md:items-start"
                  >
                    <FormField
                      control={form.control}
                      name={`options.${optionIndex}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tên thuộc tính</FormLabel>
                          <FormControl>
                            <Input
                              startIcon={<ListTreeIcon />}
                              maxLength={80}
                              placeholder="Màu sắc"
                              type="text"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`options.${optionIndex}.values`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Các giá trị</FormLabel>
                          <FormControl>
                            <Input
                              startIcon={<ListIcon />}
                              placeholder="Đen, Trắng, Xanh"
                              type="text"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      aria-label={`Xoá thuộc tính ${optionIndex + 1}`}
                      tooltip={`Xoá thuộc tính ${optionIndex + 1}`}
                      className="md:mt-6"
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={() => optionFields.remove(optionIndex)}
                    >
                      <Trash2Icon />
                    </Button>
                  </Surface>
                ))}
              </div>
              {optionsError ? (
                <p className="text-sm text-destructive" role="alert">
                  {optionsError}
                </p>
              ) : null}

              <Button type="button" variant="secondary" onClick={buildVariants}>
                <RefreshCwIcon /> Tạo / cập nhật danh sách biến thể
              </Button>

              {variantsNeedUpdate ? (
                <p className="text-sm text-destructive" role="alert">
                  Thuộc tính đã thay đổi. Hãy tạo / cập nhật danh sách biến thể
                  trước khi đăng. Giá và tồn kho của các tổ hợp còn lại sẽ được
                  giữ.
                </p>
              ) : null}

              {variantFields.fields.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      Danh sách biến thể ({variantFields.fields.length})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Giá trống sẽ dùng giá bán chung.
                    </p>
                  </div>
                  {variantFields.fields.map((variant, variantIndex) => {
                    const current = variants[variantIndex] ?? variant
                    const variantErrors =
                      form.formState.errors.variants?.[variantIndex]
                    const optionValuesError = fieldErrorMessage(
                      variantErrors?.option_values
                    )
                    const defaultError = fieldErrorMessage(
                      variantErrors?.is_default
                    )
                    return (
                      <Surface
                        padding="none"
                        variant="inset"
                        key={variant.id}
                        className="space-y-3 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium break-words">
                              {variantLabel(current.option_values)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {Object.entries(current.option_values)
                                .map(([name, value]) => `${name}: ${value}`)
                                .join(" • ")}
                            </p>
                          </div>
                          {current.is_default ? (
                            <Badge>Mặc định</Badge>
                          ) : (
                            <Button
                              startIcon={<StarIcon />}
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() => setDefaultVariant(variantIndex)}
                            >
                              Đặt mặc định
                            </Button>
                          )}
                        </div>
                        {optionValuesError || defaultError ? (
                          <p className="text-sm text-destructive" role="alert">
                            {optionValuesError || defaultError}
                          </p>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <FormField
                            control={form.control}
                            name={`variants.${variantIndex}.price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Giá riêng</FormLabel>
                                <FormControl>
                                  <Input
                                    startIcon={<BanknoteIcon />}
                                    min={1000}
                                    inputMode="numeric"
                                    placeholder="Dùng giá chung"
                                    type="number"
                                    {...field}
                                    value={field.value}
                                    onChange={(event) =>
                                      field.onChange(
                                        optionalNumericValue(event.target.value)
                                      )
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${variantIndex}.stock`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tồn kho</FormLabel>
                                <FormControl>
                                  <Input
                                    startIcon={<BoxesIcon />}
                                    min={0}
                                    inputMode="numeric"
                                    type="number"
                                    {...field}
                                    value={
                                      Number.isFinite(field.value)
                                        ? field.value
                                        : ""
                                    }
                                    onChange={(event) =>
                                      field.onChange(
                                        numericValue(event.target.value)
                                      )
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${variantIndex}.is_active`}
                            render={({ field }) => (
                              <FormItem className="rounded-lg border px-3 py-2 sm:mt-6">
                                <div className="flex items-center justify-between gap-3">
                                  <FormLabel className="cursor-pointer">
                                    Đang bán
                                  </FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      disabled={current.is_default}
                                      onBlur={field.onBlur}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </div>
                                {current.is_default ? (
                                  <FormDescription>
                                    Đổi biến thể mặc định trước khi ngừng bán.
                                  </FormDescription>
                                ) : null}
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </Surface>
                    )
                  })}
                </div>
              ) : (
                <Surface
                  padding="none"
                  variant="dashed"
                  className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
                >
                  <ImagePlusIcon className="size-4 shrink-0" />
                  Nhập thuộc tính rồi tạo danh sách biến thể để khai báo giá và
                  tồn kho riêng. SKU sẽ được hệ thống tự động tạo.
                </Surface>
              )}
              {variantsError ? (
                <p className="text-sm text-destructive" role="alert">
                  {variantsError}
                </p>
              ) : null}
            </Surface>
          )}
        </section>

        <ImageUploadProgress progress={isPending ? uploadProgress : null} />
        <FormSubmitButton
          startIcon={<PackagePlusIcon />}
          className="w-full sm:w-auto"
          disabled={categories.length === 0 || preparingImages}
          idleText="Đăng sản phẩm"
          pending={isPending}
          pendingText="Đang đăng..."
        />
      </form>
    </Form>
  )
}
