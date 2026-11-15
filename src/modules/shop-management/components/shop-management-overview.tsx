"use client"

import {
  ArrowRightIcon,
  BoxesIcon,
  MessageSquareTextIcon,
  PackageIcon,
  ReceiptTextIcon,
  TrendingUpIcon,
} from "lucide-react"

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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/format"
import { orderStatusLabels } from "@/modules/shop-management/lib/management-data"
import type { ManagementTab } from "@/modules/shop-management/lib/management-navigation"
import type { ShopMetrics, ShopOrder, ShopProduct } from "@/types/shop"

export function ShopManagementOverview({
  products,
  orders,
  metrics,
  openOrders,
  lowStock,
  unansweredReviews,
  onNavigate,
  onTask,
}: {
  products: ShopProduct[]
  orders: ShopOrder[]
  metrics?: ShopMetrics
  openOrders: number
  lowStock: number
  unansweredReviews: number
  onNavigate: (tab: ManagementTab) => void
  onTask: (tab: "orders" | "inventory" | "reviews") => void
}) {
  const recentOrders = [...orders]
    .sort(
      (a, b) =>
        (b.created_at ? Date.parse(b.created_at) || 0 : 0) -
        (a.created_at ? Date.parse(a.created_at) || 0 : 0)
    )
    .slice(0, 5)
  const summary = [
    {
      label: "Doanh thu",
      value: formatCurrency(
        metrics?.total_revenue ??
          orders
            .filter((order) => order.status === "completed")
            .reduce((sum, order) => sum + order.total, 0)
      ),
      description: metrics
        ? "Từ các đơn hàng hoàn tất"
        : "Từ các đơn hoàn tất trong danh sách",
      icon: TrendingUpIcon,
    },
    {
      label: "Tổng đơn hàng",
      value: metrics?.total_orders_count ?? orders.length,
      description: `${openOrders} đơn đang mở`,
      icon: ReceiptTextIcon,
    },
    {
      label: "Sản phẩm đang bán",
      value:
        metrics?.products_count ??
        products.filter((product) => product.is_active).length,
      description: `${metrics?.hidden_products_count ?? products.filter((product) => !product.is_active).length} sản phẩm đang ẩn`,
      icon: PackageIcon,
    },
    {
      label: "Tổng tồn kho",
      value:
        metrics?.total_stock ??
        products.reduce((sum, product) => sum + product.stock, 0),
      description: `${lowStock} sản phẩm đang bán còn ≤ 5 đơn vị`,
      icon: BoxesIcon,
    },
  ]
  const tasks = [
    {
      tab: "orders",
      title: "Đơn hàng đang mở",
      description: "Xác nhận, chuẩn bị và theo dõi giao hàng",
      count: openOrders,
      icon: ReceiptTextIcon,
    },
    {
      tab: "inventory",
      title: "Sản phẩm sắp hết hàng",
      description: "Kiểm tra hàng đang bán còn tối đa 5 đơn vị",
      count: lowStock,
      icon: BoxesIcon,
    },
    {
      tab: "reviews",
      title: "Đánh giá chưa phản hồi",
      description: "Trả lời những đánh giá gần đây của khách",
      count: unansweredReviews,
      icon: MessageSquareTextIcon,
    },
  ] as const

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summary.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            description={metric.description}
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
              Ưu tiên vận hành và chăm sóc khách hàng.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup>
              {tasks.map((task) => (
                <Item
                  key={task.tab}
                  variant="interactive"
                  render={
                    <Button
                      variant="ghost"
                      className="h-auto justify-start whitespace-normal"
                      onClick={() => onTask(task.tab)}
                    />
                  }
                >
                  <ItemMedia variant="icon">
                    <task.icon aria-hidden="true" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{task.title}</ItemTitle>
                    <ItemDescription>{task.description}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant={task.count > 0 ? "default" : "secondary"}>
                      {task.count}
                    </Badge>
                    <ArrowRightIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trải nghiệm khách hàng</CardTitle>
            <CardDescription>Chỉ số tương tác của cửa hàng.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              {[
                {
                  label: "Người theo dõi",
                  value: metrics?.followers_count ?? "—",
                },
                {
                  label: "Tỷ lệ hài lòng",
                  value:
                    metrics?.satisfaction_rate == null
                      ? "—"
                      : `${metrics.satisfaction_rate}%`,
                },
                {
                  label: "Hội thoại khách hàng",
                  value: metrics?.customer_conversations_count ?? "—",
                },
                {
                  label: "Tỷ lệ phản hồi",
                  value:
                    metrics?.response_rate == null
                      ? "—"
                      : `${metrics.response_rate}%`,
                },
              ].map((metric) => (
                <div key={metric.label} className="space-y-1">
                  <dt className="text-xs text-muted-foreground">
                    {metric.label}
                  </dt>
                  <dd className="text-xl font-semibold tabular-nums">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Đơn hàng gần đây</CardTitle>
          <CardDescription>Tối đa 5 đơn hàng mới nhất.</CardDescription>
          <CardAction>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("orders")}
            >
              Xem tất cả <ArrowRightIcon aria-hidden="true" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã đơn hàng</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Khách hàng
                  </TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <p className="font-medium">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.created_at)}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {order.customer_name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.status === "completed"
                            ? "success"
                            : order.status === "cancelled"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {orderStatusLabels[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(order.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ReceiptTextIcon />
                </EmptyMedia>
                <EmptyTitle>Chưa có đơn hàng</EmptyTitle>
                <EmptyDescription>
                  Đơn hàng mới sẽ xuất hiện tại đây để bạn theo dõi và xử lý.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
