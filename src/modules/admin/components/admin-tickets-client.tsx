"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  UserRoundIcon,
  ExternalLinkIcon,
  ClipboardCheckIcon,
  MessageSquareIcon,
  EyeIcon,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { getAdminTicket } from "@/api/admin/queries"
import { FormSelect } from "@/components/form-select"
import { FormSubmitButton } from "@/components/form-submit-button"
import { DataPagination } from "@/components/layout/data-pagination"
import { EmptyState } from "@/components/layout/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Surface } from "@/components/ui/surface"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import { QueryPlaceholder, useApiQuery } from "@/hooks/use-api-query"
import { formatDate } from "@/lib/format"
import { applyServerErrors } from "@/lib/form-utils"
import { reviewTicketAction } from "@/modules/admin/actions"
import { AdminChatButton } from "@/modules/admin/components/admin-account-actions"
import { AdminFilterBar } from "@/modules/admin/components/admin-filter-bar"
import {
  adminSourceHref,
  ticketSourceOptions,
  ticketStatusOptions,
  ticketTypeOptions,
} from "@/modules/admin/lib/admin-navigation"
import {
  reviewTicketSchema,
  type ReviewTicketValues,
} from "@/modules/admin/schemas/admin"
import type { PaginatedResponse } from "@/types/common"
import type { Ticket } from "@/types/ticket"
import type { AdminTicketSummary } from "@/types/admin"

function TicketContext({ ticket }: { ticket: Ticket }) {
  const upgrade = ticket.metadata?.shop_owner_upgrade
  const sourceHref = adminSourceHref(ticket.metadata?.source_url)
  const labels: Record<string, string> = {
    full_name: "Họ tên",
    shop_name: "Tên cửa hàng",
    shop_description: "Mô tả cửa hàng",
    email: "Email cá nhân",
    shop_email: "Email cửa hàng",
    phone_number: "Điện thoại cá nhân",
    shop_phone_number: "Điện thoại cửa hàng",
    province: "Tỉnh / thành phố",
    ward: "Phường / xã",
    address_detail: "Địa chỉ chi tiết",
  }
  return (
    <div className="space-y-4">
      <Surface render={<dl />} className="grid gap-3 sm:grid-cols-2">
        {[
          ["Email người gửi", ticket.user?.email],
          ["Mã người dùng", ticket.user?.user_code],
          ["Nguồn gửi", ticket.source_label],
          ["Ngày gửi", formatDate(ticket.created_at)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm wrap-anywhere">
              {value || "Chưa cập nhật"}
            </dd>
          </div>
        ))}
      </Surface>
      {upgrade ? (
        <Surface>
          <h3 className="mb-3 font-medium">Thông tin đăng ký chủ cửa hàng</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {Object.entries(upgrade).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">
                  {labels[key] ?? key}
                </dt>
                <dd className="mt-1 text-sm wrap-anywhere">
                  {value || "Chưa cập nhật"}
                </dd>
              </div>
            ))}
          </dl>
        </Surface>
      ) : null}
      {ticket.metadata?.lock_reason || ticket.user?.lock_reason ? (
        <Surface variant="danger">
          <p>
            Lý do khóa:{" "}
            {ticket.metadata?.lock_reason || ticket.user?.lock_reason}
          </p>
        </Surface>
      ) : null}
      {ticket.metadata?.notification_title ? (
        <Surface>
          <p className="text-xs text-muted-foreground">Thông báo liên quan</p>
          <p className="mt-1">{ticket.metadata.notification_title}</p>
        </Surface>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {ticket.user ? (
          <>
            <AdminChatButton
              userId={ticket.user.id}
              name={ticket.user.full_name}
            />
            <Button
              startIcon={<UserRoundIcon aria-hidden="true" />}
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <Link
                  href={`/admin/users?search=${encodeURIComponent(ticket.user.email)}`}
                />
              }
            >
              Xem người dùng
            </Button>
          </>
        ) : null}
        {sourceHref ? (
          <Button
            startIcon={<ExternalLinkIcon aria-hidden="true" />}
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Mở trang liên quan
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function TicketForm({ ticket }: { ticket: Ticket }) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<ReviewTicketValues>({
    resolver: zodResolver(reviewTicketSchema),
    defaultValues: {
      status:
        ticket.status === "approved" || ticket.status === "rejected"
          ? ticket.status
          : "approved",
      admin_note: ticket.admin_note ?? "",
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await reviewTicketAction(ticket.id, values)
      const generalError = state.errors?.general?.[0]
      const fieldErrors = state.errors
        ? Object.fromEntries(
            Object.entries(state.errors).filter(
              ([field]) => field !== "general"
            )
          )
        : undefined
      const hasFieldErrors = applyServerErrors(fieldErrors, form.setError)
      if (state.success) {
        toast.success(state.message)
        return
      }
      if (generalError) toast.error(generalError)
      else if (!hasFieldErrors && state.message) toast.error(state.message)
    })
  })
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start gap-3">
          <UserAvatar
            name={ticket.user?.full_name ?? "Ẩn danh"}
            size="lg"
            src={ticket.user?.avatar_url}
          />
          <div className="min-w-0 flex-1">
            <CardTitle>{ticket.type_label}</CardTitle>
            <CardDescription>
              {ticket.user?.full_name ?? "Ẩn danh"}
            </CardDescription>
          </div>
          <Badge
            variant={
              ticket.status === "approved"
                ? "success"
                : ticket.status === "rejected"
                  ? "destructive"
                  : "warning"
            }
          >
            {ticket.status === "approved"
              ? "Đã duyệt"
              : ticket.status === "rejected"
                ? "Đã từ chối"
                : "Chờ xử lý"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="gap-5">
        <p className="text-sm wrap-anywhere whitespace-pre-wrap">
          {ticket.message}
        </p>
        <TicketContext ticket={ticket} />
        {ticket.status === "pending" ? (
          <Form {...form}>
            <Surface>
              <form className="space-y-4" noValidate onSubmit={onSubmit}>
                <h3 className="font-medium">Xử lý yêu cầu</h3>
                <FormField
                  control={form.control}
                  name="status"
                  rules={{ deps: "admin_note" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quyết định</FormLabel>
                      <FormSelect
                        startIcon={<ClipboardCheckIcon />}
                        placeholder="Chọn quyết định xử lý"
                        ref={field.ref}
                        name={field.name}
                        options={[
                          { label: "Duyệt", value: "approved" },
                          { label: "Từ chối", value: "rejected" },
                        ]}
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
                  name="admin_note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ghi chú quản trị viên</FormLabel>
                      <FormControl>
                        <Textarea
                          startIcon={<MessageSquareIcon />}
                          {...field}
                          maxLength={1000}
                          disabled={isPending}
                          placeholder="Nhập ghi chú hoặc lý do từ chối"
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormSubmitButton
                  startIcon={<ClipboardCheckIcon />}
                  idleText="Cập nhật yêu cầu"
                  pending={isPending}
                  pendingText="Đang lưu..."
                />
              </form>
            </Surface>
          </Form>
        ) : (
          <Surface variant="muted">
            <h3 className="font-medium">Kết quả xử lý</h3>
            <p className="mt-2 text-sm wrap-anywhere whitespace-pre-wrap">
              {ticket.admin_note || "Không có ghi chú."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {ticket.reviewer?.full_name || "Quản trị viên"} ·{" "}
              {formatDate(ticket.reviewed_at)}
            </p>
          </Surface>
        )}
      </CardContent>
    </Card>
  )
}

function TicketDetails({ ticketId }: { ticketId: string }) {
  const { data, error } = useApiQuery(`admin-ticket:${ticketId}`, () =>
    getAdminTicket(ticketId)
  )
  if (!data) return <QueryPlaceholder error={error} />
  return data.selectedTicket ? (
    <TicketForm
      key={`${data.selectedTicket.id}:${data.selectedTicket.status}`}
      ticket={data.selectedTicket}
    />
  ) : (
    <EmptyState
      title="Không tìm thấy yêu cầu"
      description="Yêu cầu có thể đã bị xóa hoặc bạn không còn quyền truy cập."
    />
  )
}

export function AdminTicketsClient({
  tickets,
}: {
  tickets: PaginatedResponse<AdminTicketSummary>
}) {
  const query = useSearchParams()
  const router = useRouter()
  const selectedId = query.get("ticket")
  const select = (id: string | null) => {
    const params = new URLSearchParams(query.toString())
    if (id) params.set("ticket", id)
    else params.delete("ticket")
    const search = params.toString()
    const href = search ? `/admin/tickets?${search}` : "/admin/tickets"
    if (id) router.push(href, { scroll: false })
    else router.replace(href, { scroll: false })
  }
  return (
    <div className="space-y-6">
      <AdminFilterBar
        fields={[
          {
            key: "status",
            label: "Trạng thái yêu cầu",
            options: ticketStatusOptions,
          },
          { key: "type", label: "Loại yêu cầu", options: ticketTypeOptions },
          { key: "source", label: "Nguồn gửi", options: ticketSourceOptions },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Danh sách yêu cầu</CardTitle>
          <CardDescription>
            {tickets.total} yêu cầu phù hợp · Ưu tiên yêu cầu chưa xử lý
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.data.length ? (
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead>Yêu cầu</TableHead>
                  <TableHead>Người gửi</TableHead>
                  <TableHead>Ngày gửi</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.data.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <p className="font-medium">{ticket.type_label}</p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.source_label}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{ticket.user?.full_name ?? "Ẩn danh"}</p>
                      <p className="max-w-52 truncate text-xs text-muted-foreground">
                        {ticket.user?.email}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(ticket.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ticket.status === "approved"
                            ? "success"
                            : ticket.status === "rejected"
                              ? "destructive"
                              : "warning"
                        }
                      >
                        {ticket.status === "approved"
                          ? "Đã duyệt"
                          : ticket.status === "rejected"
                            ? "Đã từ chối"
                            : "Chờ xử lý"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Xem yêu cầu của ${ticket.user?.full_name ?? "Ẩn danh"}`}
                        onClick={() => select(ticket.id)}
                      >
                        <EyeIcon />
                        {ticket.status === "pending" ? "Xử lý" : "Chi tiết"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="Không có yêu cầu phù hợp"
              description="Thay đổi bộ lọc để kiểm tra các yêu cầu khác."
            />
          )}
          <DataPagination
            currentPage={tickets.current_page}
            lastPage={tickets.last_page}
          />
        </CardContent>
      </Card>
      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) select(null)
        }}
      >
        <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:max-w-3xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>Chi tiết yêu cầu hỗ trợ</SheetTitle>
            <SheetDescription>
              Kiểm tra thông tin trước khi đưa ra quyết định.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {selectedId ? (
              <TicketDetails key={selectedId} ticketId={selectedId} />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
