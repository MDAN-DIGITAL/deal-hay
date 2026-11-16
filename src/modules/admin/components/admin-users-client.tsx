"use client"

import { useState } from "react"
import { EyeIcon } from "lucide-react"
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
import { UserAvatar } from "@/components/user-avatar"
import { formatDate } from "@/lib/format"
import {
  AdminAccountLockButton,
  AdminChatButton,
} from "@/modules/admin/components/admin-account-actions"
import { AdminFilterBar } from "@/modules/admin/components/admin-filter-bar"
import {
  accountStatusOptions,
  roleLabels,
} from "@/modules/admin/lib/admin-navigation"
import type { User } from "@/types/auth"
import type { PaginatedResponse } from "@/types/common"

export function AdminUsersClient({
  users,
  currentUserId,
}: {
  users: PaginatedResponse<User>
  currentUserId: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = users.data.find((user) => user.id === selectedId)
  return (
    <div className="space-y-6">
      <AdminFilterBar
        searchPlaceholder="Tìm tên, email, số điện thoại hoặc mã người dùng"
        fields={[
          {
            key: "role",
            label: "Vai trò",
            options: [
              { value: "all", label: "Tất cả vai trò" },
              ...Object.entries(roleLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ],
          },
          {
            key: "status",
            label: "Trạng thái tài khoản",
            options: accountStatusOptions,
          },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Danh sách tài khoản</CardTitle>
          <CardDescription>
            {users.total} tài khoản phù hợp · Trang {users.current_page ?? 1}/
            {users.last_page ?? 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.data.length ? (
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Hoạt động</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.map((user) => {
                  const active = Number(user.is_active) === 1
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={user.full_name}
                            src={user.avatar_url}
                          />
                          <div className="min-w-0">
                            <p className="max-w-56 truncate font-medium">
                              {user.full_name}
                            </p>
                            <p className="max-w-56 truncate text-xs text-muted-foreground">
                              {user.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {user.user_code}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {roleLabels[user.role] ?? user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={active ? "success" : "destructive"}>
                          {active ? "Hoạt động" : "Đã khóa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.online_status?.label ?? "Chưa hoạt động"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Xem chi tiết ${user.full_name}`}
                            onClick={() => setSelectedId(user.id)}
                          >
                            <EyeIcon />
                            Chi tiết
                          </Button>
                          <AdminChatButton
                            userId={user.id}
                            name={user.full_name}
                          />
                          {user.id !== currentUserId &&
                          user.role !== "administrator" ? (
                            <AdminAccountLockButton
                              id={user.id}
                              name={user.full_name}
                              isActive={active}
                              lockReason={user.lock_reason}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Được bảo vệ
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="Không tìm thấy tài khoản"
              description="Thử thay đổi từ khóa hoặc bộ lọc để xem thêm người dùng."
            />
          )}
          <DataPagination
            currentPage={users.current_page}
            lastPage={users.last_page}
          />
        </CardContent>
      </Card>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      >
        <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:max-w-xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>Chi tiết người dùng</SheetTitle>
            <SheetDescription>
              Thông tin tài khoản và trạng thái truy cập.
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="space-y-5 px-4 pb-6">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={selected.full_name}
                  src={selected.avatar_url}
                  size="lg"
                />
                <div>
                  <h2 className="font-semibold">{selected.full_name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {roleLabels[selected.role] ?? selected.role}
                  </p>
                </div>
              </div>
              <Surface render={<dl />} className="grid gap-4">
                {[
                  ["Mã người dùng", selected.user_code],
                  ["Email", selected.email],
                  ["Số điện thoại", selected.phone_number],
                  [
                    "Địa chỉ",
                    [selected.address_detail, selected.ward, selected.province]
                      .filter(Boolean)
                      .join(", "),
                  ],
                  ["Ngày tạo", formatDate(selected.created_at)],
                  ["Hoạt động", selected.online_status?.label],
                  [
                    "Trạng thái",
                    Number(selected.is_active) === 1
                      ? "Đang hoạt động"
                      : "Đã khóa",
                  ],
                  ["Lý do khóa", selected.lock_reason],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-sm wrap-anywhere">
                      {value || "Chưa cập nhật"}
                    </dd>
                  </div>
                ))}
              </Surface>
              <div className="flex flex-wrap gap-2">
                <AdminChatButton
                  userId={selected.id}
                  name={selected.full_name}
                />
                {selected.id !== currentUserId &&
                selected.role !== "administrator" ? (
                  <AdminAccountLockButton
                    id={selected.id}
                    name={selected.full_name}
                    isActive={Number(selected.is_active) === 1}
                    lockReason={selected.lock_reason}
                  />
                ) : (
                  <Badge variant="secondary">
                    Tài khoản quản trị được bảo vệ
                  </Badge>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
