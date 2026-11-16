"use client"

import Link from "next/link"
import {
  ArrowRightIcon,
  FolderTreeIcon,
  LockIcon,
  StoreIcon,
  TicketCheckIcon,
  UsersIcon,
} from "lucide-react"
import {
  getAdminCategories,
  getAdminShops,
  getAdminTickets,
  getAdminUsers,
} from "@/api/admin/queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/layout/empty-state"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { StatCard } from "@/components/ui/section"
import { QueryPlaceholder, useApiQuery } from "@/hooks/use-api-query"
import { formatDate } from "@/lib/format"

export function AdminOverview() {
  const { data, error } = useApiQuery("admin-overview", async () => {
    const [users, shops, categories, pending, locked] = await Promise.all([
      getAdminUsers(),
      getAdminShops(),
      getAdminCategories(),
      getAdminTickets(undefined, "pending"),
      getAdminShops(undefined, "locked"),
    ])
    return {
      users: users.users,
      shops: shops.shops,
      categories: categories.categories,
      pending: pending.tickets,
      locked: locked.shops,
    }
  })
  if (!data) return <QueryPlaceholder error={error} />
  const metrics = [
    {
      label: "Người dùng",
      value: data.users.total,
      icon: UsersIcon,
      description: "Tài khoản trong hệ thống",
    },
    {
      label: "Cửa hàng",
      value: data.shops.total,
      icon: StoreIcon,
      description: "Tổng số gian hàng",
    },
    {
      label: "Danh mục",
      value: data.categories.length,
      icon: FolderTreeIcon,
      description: `${data.categories.filter((category) => category.is_active).length} danh mục đang hiển thị`,
    },
    {
      label: "Yêu cầu chờ xử lý",
      value: data.pending.total,
      icon: TicketCheckIcon,
      description: "Cần quản trị viên xem xét",
    },
  ]
  const tasks = [
    {
      href: "/admin/tickets?status=pending",
      label: "Yêu cầu cần xử lý",
      description: "Duyệt nâng cấp, mở khóa và khiếu nại",
      count: data.pending.total,
      icon: TicketCheckIcon,
    },
    {
      href: "/admin/shops?status=locked",
      label: "Cửa hàng đang khóa",
      description: "Kiểm tra tình trạng và lý do khóa",
      count: data.locked.total,
      icon: LockIcon,
    },
    {
      href: "/admin/categories",
      label: "Danh mục đang ẩn",
      description: "Rà soát danh mục sản phẩm dùng chung",
      count: data.categories.filter((category) => !category.is_active).length,
      icon: FolderTreeIcon,
    },
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <StatCard
            key={metric.label}
            {...metric}
            icon={<metric.icon />}
            compact
          />
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Công việc cần xử lý</CardTitle>
            <CardDescription>
              Ưu tiên hỗ trợ và kiểm soát hoạt động hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup>
              {tasks.map((task) => (
                <Item
                  key={task.href}
                  variant="interactive"
                  render={<Link href={task.href} />}
                >
                  <ItemMedia variant="icon">
                    <task.icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{task.label}</ItemTitle>
                    <ItemDescription>{task.description}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant={task.count ? "default" : "secondary"}>
                      {task.count}
                    </Badge>
                    <ArrowRightIcon className="size-4" />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quản lý nhanh</CardTitle>
            <CardDescription>
              Tra cứu và kiểm tra dữ liệu vận hành.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-3">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/admin/users" />}
            >
              <UsersIcon />
              Quản lý người dùng
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/admin/shops" />}
            >
              <StoreIcon />
              Quản lý cửa hàng
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/admin/categories" />}
            >
              <FolderTreeIcon />
              Quản lý danh mục
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Yêu cầu đang chờ xử lý</CardTitle>
          <CardDescription>
            Các yêu cầu mới nhất cần được quản trị viên xem xét.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.pending.data.length ? (
            <ItemGroup>
              {data.pending.data.slice(0, 5).map((ticket) => (
                <Item
                  key={ticket.id}
                  variant="interactive"
                  render={
                    <Link
                      href={`/admin/tickets?status=pending&ticket=${encodeURIComponent(ticket.id)}`}
                    />
                  }
                >
                  <ItemContent>
                    <ItemTitle>{ticket.type_label}</ItemTitle>
                    <ItemDescription>
                      {ticket.user?.full_name ?? "Ẩn danh"} ·{" "}
                      {formatDate(ticket.created_at)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant="warning">Chờ xử lý</Badge>
                    <ArrowRightIcon className="size-4" />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          ) : (
            <EmptyState
              title="Đã xử lý hết yêu cầu"
              description="Yêu cầu mới sẽ xuất hiện tại đây."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
