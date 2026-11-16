"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { FormSubmitButton } from "@/components/form-submit-button"
import { EmptyState } from "@/components/layout/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Surface } from "@/components/ui/surface"
import { applyServerErrors } from "@/lib/form-utils"
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/modules/admin/actions"
import { adminErrorMessage } from "@/modules/admin/components/admin-account-actions"
import {
  categorySchema,
  type CategoryValues,
} from "@/modules/admin/schemas/admin"
import type { ProductCategory } from "@/types/admin"

function CategoryEditor({
  category,
  onSaved,
}: {
  category?: ProductCategory
  onSaved: () => void
}) {
  const [pending, startTransition] = useTransition()
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      is_active: category?.is_active ?? true,
    },
  })
  return (
    <Form {...form}>
      <form
        className="space-y-5 px-4 pb-6"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          startTransition(async () => {
            const result = category
              ? await updateCategoryAction(category.id, values)
              : await createCategoryAction(values)
            const fieldErrors = applyServerErrors(result.errors, form.setError)
            if (result.success) {
              toast.success(result.message)
              onSaved()
            } else if (!fieldErrors) toast.error(result.message)
          })
        )}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên danh mục</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  maxLength={120}
                  placeholder="Ví dụ: Điện thoại và phụ kiện"
                  disabled={pending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-4">
                <FormLabel>Hiển thị danh mục</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                    disabled={pending}
                  />
                </FormControl>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Danh mục đang ẩn sẽ không được hiển thị trong danh sách công
                khai.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormSubmitButton
          pending={pending}
          idleText={category ? "Lưu thay đổi" : "Thêm danh mục"}
          pendingText="Đang lưu..."
        />
      </form>
    </Form>
  )
}

export function AdminCategoriesClient({
  categories,
}: {
  categories: ProductCategory[]
}) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [editor, setEditor] = useState<{ category?: ProductCategory } | null>(
    null
  )
  const [deleting, setDeleting] = useState<ProductCategory | null>(null)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const visible = categories.filter(
    (category) =>
      category.name
        .toLocaleLowerCase("vi")
        .includes(search.trim().toLocaleLowerCase("vi")) &&
      (status === "all" || category.is_active === (status === "active"))
  )
  return (
    <div className="space-y-6">
      <Surface variant="muted" className="flex flex-col gap-3 sm:flex-row">
        <InputGroup variant="search" className="flex-1">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Tìm danh mục"
            placeholder="Tìm danh mục"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
        <Select
          items={[
            { value: "all", label: "Tất cả trạng thái" },
            { value: "active", label: "Đang hiển thị" },
            { value: "hidden", label: "Đang ẩn" },
          ]}
          value={status}
          onValueChange={(value) => setStatus(value ?? "all")}
        >
          <SelectTrigger
            aria-label="Trạng thái danh mục"
            className="w-full sm:w-48"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="active">Đang hiển thị</SelectItem>
            <SelectItem value="hidden">Đang ẩn</SelectItem>
          </SelectContent>
        </Select>
      </Surface>
      <Card>
        <CardHeader>
          <CardTitle>Danh mục sản phẩm</CardTitle>
          <CardDescription>
            {visible.length}/{categories.length} danh mục ·{" "}
            {categories.filter((category) => category.is_active).length} đang
            hiển thị
          </CardDescription>
          <CardAction>
            <Button onClick={() => setEditor({})}>
              <PlusIcon />
              Thêm danh mục
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {visible.length ? (
            <Table className="min-w-160">
              <TableHeader>
                <TableRow>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>Cửa hàng</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={category.is_active ? "success" : "secondary"}
                      >
                        {category.is_active ? "Hiển thị" : "Đang ẩn"}
                      </Badge>
                    </TableCell>
                    <TableCell>{category.products_count}</TableCell>
                    <TableCell>{category.shops_count}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Sửa ${category.name}`}
                          onClick={() => setEditor({ category })}
                        >
                          <PencilIcon />
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          aria-label={`${category.is_active ? "Ẩn" : "Hiện"} ${category.name}`}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await updateCategoryAction(
                                category.id,
                                {
                                  name: category.name,
                                  is_active: !category.is_active,
                                }
                              )
                              if (result.success) toast.success(result.message)
                              else toast.error(result.message)
                            })
                          }
                        >
                          {category.is_active ? <EyeOffIcon /> : <EyeIcon />}
                          {category.is_active ? "Ẩn" : "Hiện"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          aria-label={`Xóa ${category.name}`}
                          onClick={() => {
                            setDeleting(category)
                            setError("")
                          }}
                        >
                          <Trash2Icon />
                          Xóa
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="Không có danh mục phù hợp"
              description="Thay đổi từ khóa, bộ lọc hoặc thêm danh mục mới."
            />
          )}
        </CardContent>
      </Card>
      <Sheet
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      >
        <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:max-w-lg">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>
              {editor?.category ? "Chỉnh sửa danh mục" : "Thêm danh mục"}
            </SheetTitle>
            <SheetDescription>
              Danh mục dùng chung cho các cửa hàng trong hệ thống.
            </SheetDescription>
          </SheetHeader>
          {editor ? (
            <CategoryEditor
              key={editor.category?.id ?? "create"}
              category={editor.category}
              onSaved={() => setEditor(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!pending && !open) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa danh mục {deleting?.name}?</DialogTitle>
            <DialogDescription>
              {deleting?.products_count
                ? "Danh mục đang có sản phẩm nên không thể xóa. Bạn có thể ẩn danh mục khỏi danh sách công khai."
                : "Thao tác này sẽ xóa danh mục khỏi hệ thống và không thể hoàn tác."}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={pending || Boolean(deleting?.products_count)}
              onClick={() => {
                if (!deleting) return
                startTransition(async () => {
                  try {
                    await deleteCategoryAction(deleting.id)
                    toast.success("Đã xóa danh mục.")
                    setDeleting(null)
                  } catch (error) {
                    setError(
                      adminErrorMessage(error, "Không thể xóa danh mục.")
                    )
                  }
                })
              }}
            >
              {pending ? "Đang xóa..." : "Xóa danh mục"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
