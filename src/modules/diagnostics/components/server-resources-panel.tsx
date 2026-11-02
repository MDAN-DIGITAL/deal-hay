"use client"

import {
  CpuIcon,
  HardDriveIcon,
  LoaderCircleIcon,
  MemoryStickIcon,
  RefreshCwIcon,
  ServerIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Surface } from "@/components/ui/surface"
import { useServerResources } from "@/modules/diagnostics/hooks/use-server-resources"
import type { ResourceScope } from "@/types/server-resources"

const unavailable = "Không có dữ liệu"
function numeric(value: number | null, digits = 2) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(
        value
      )
}
function bytes(value: number | null) {
  if (value === null) return unavailable
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"]
  const exponent =
    value === 0
      ? 0
      : Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${numeric(value / 1024 ** exponent)} ${units[exponent]}`
}
function exactBytes(value: number | null) {
  return value === null ? unavailable : `${numeric(value, 0)} B`
}
function sampledAt(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value))
}
function scopeLabel(scope: ResourceScope) {
  return scope === "container"
    ? "Container"
    : scope === "host"
      ? "Máy host"
      : unavailable
}

export function ServerResourcesPanel() {
  const { states, refresh, loading } = useServerResources()
  return (
    <section className="space-y-4" aria-labelledby="resources-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 id="resources-heading" className="text-xl font-semibold">
            Tài nguyên máy chủ
          </h2>
          <p className="text-sm text-muted-foreground">
            Cập nhật mỗi 5 giây từ từng máy đang phục vụ yêu cầu.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={refresh}
        >
          {loading ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <RefreshCwIcon />
          )}{" "}
          Làm mới số liệu
        </Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {(["backend", "wss"] as const).map((target) => {
          const state = states[target],
            data = state.data
          return (
            <Card key={target}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ServerIcon className="size-4 text-primary" />
                  {target === "backend" ? "DealHay Backend" : "DealHay WSS"}
                </CardTitle>
                <CardDescription>
                  {data
                    ? `Mẫu lúc ${sampledAt(data.sampled_at)}`
                    : state.loading
                      ? "Đang lấy số đo từ máy chủ…"
                      : unavailable}
                  {state.error && data ? " · Mẫu cũ" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-4">
                {state.error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                  </Alert>
                ) : null}
                {data ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          name: "CPU",
                          icon: CpuIcon,
                          percent: data.cpu.percent,
                          detail: scopeLabel(data.cpu.scope),
                        },
                        {
                          name: "RAM",
                          icon: MemoryStickIcon,
                          percent: data.memory.percent,
                          detail: scopeLabel(data.memory.scope),
                        },
                        {
                          name: "Ổ đĩa",
                          icon: HardDriveIcon,
                          percent: data.disk.percent,
                          detail:
                            data.disk.scope === "filesystem"
                              ? "Filesystem"
                              : unavailable,
                        },
                      ].map((metric) => (
                        <Surface
                          key={metric.name}
                          variant="muted"
                          padding="sm"
                          className="space-y-3"
                        >
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <metric.icon className="size-4" />
                            {metric.name}
                          </p>
                          <p className="text-2xl font-semibold tabular-nums">
                            {numeric(metric.percent)}
                            {metric.percent === null ? "" : "%"}
                          </p>
                          <Progress
                            value={
                              metric.percent === null
                                ? null
                                : Math.min(100, metric.percent)
                            }
                            aria-label={`${metric.name} đã sử dụng`}
                          />
                          <p className="text-xs text-muted-foreground">
                            {metric.detail}
                          </p>
                        </Surface>
                      ))}
                    </div>
                    <dl className="space-y-3 text-sm [&_dd]:max-w-full [&_dd]:break-words [&_dd]:tabular-nums [&_dt]:text-muted-foreground [&>div]:flex [&>div]:flex-wrap [&>div]:justify-between [&>div]:gap-x-4 [&>div]:gap-y-1">
                      <div>
                        <dt>Bộ xử lý</dt>
                        <dd>{data.cpu.model || unavailable}</dd>
                      </div>
                      <div>
                        <dt>Giới hạn CPU</dt>
                        <dd>
                          {data.cpu.allocated_cores === null
                            ? unavailable
                            : `${numeric(data.cpu.allocated_cores, 4)} vCPU`}
                        </dd>
                      </div>
                      <div>
                        <dt>CPU hệ thống nhìn thấy</dt>
                        <dd>
                          {numeric(data.cpu.visible_logical_cores, 0)} luồng
                        </dd>
                      </div>
                      <div>
                        <dt>RAM đã dùng / giới hạn</dt>
                        <dd
                          title={`${exactBytes(data.memory.used_bytes)} / ${exactBytes(data.memory.limit_bytes)}`}
                        >
                          {bytes(data.memory.used_bytes)} /{" "}
                          {bytes(data.memory.limit_bytes)}
                        </dd>
                      </div>
                      <div>
                        <dt>RAM khả dụng</dt>
                        <dd title={exactBytes(data.memory.available_bytes)}>
                          {bytes(data.memory.available_bytes)}
                        </dd>
                      </div>
                      <div>
                        <dt>Ổ đĩa đã dùng / tổng filesystem</dt>
                        <dd
                          title={`${exactBytes(data.disk.used_bytes)} / ${exactBytes(data.disk.total_bytes)}`}
                        >
                          {bytes(data.disk.used_bytes)} /{" "}
                          {bytes(data.disk.total_bytes)}
                        </dd>
                      </div>
                      <div>
                        <dt>Ổ đĩa còn khả dụng</dt>
                        <dd title={exactBytes(data.disk.available_bytes)}>
                          {bytes(data.disk.available_bytes)}
                        </dd>
                      </div>
                      <div>
                        <dt>Hạn mức ổ đĩa được cấp</dt>
                        <dd title={exactBytes(data.disk.allocated_bytes)}>
                          {bytes(data.disk.allocated_bytes)}
                        </dd>
                      </div>
                      <div>
                        <dt>Hệ điều hành</dt>
                        <dd>
                          {data.os.name || data.os.platform || unavailable}
                        </dd>
                      </div>
                      <div>
                        <dt>Kernel / kiến trúc</dt>
                        <dd>
                          {data.os.release || "—"} /{" "}
                          {data.os.architecture || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>RAM tiến trình (RSS)</dt>
                        <dd title={exactBytes(data.process.rss_bytes)}>
                          {bytes(data.process.rss_bytes)}
                        </dd>
                      </div>
                      <div>
                        <dt>Tiến trình hoạt động</dt>
                        <dd>
                          {data.process.uptime_seconds === null
                            ? unavailable
                            : `${numeric(data.process.uptime_seconds, 0)} giây`}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">CPU: {data.cpu.source}</Badge>
                      <Badge variant="outline">RAM: {data.memory.source}</Badge>
                      <Badge variant="outline">
                        Cửa sổ CPU: {numeric(data.sample_window_ms, 0)} ms
                      </Badge>
                    </div>
                    <p className="text-xs break-all text-muted-foreground">
                      Instance: {data.instance_id}
                    </p>
                  </>
                ) : !state.error ? (
                  <p
                    role="status"
                    className="py-6 text-sm text-muted-foreground"
                  >
                    Đang lấy dữ liệu thực tế…
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        CPU là mức sử dụng trong cửa sổ lấy mẫu; giới hạn vCPU/RAM lấy từ hệ
        điều hành hoặc cgroup khi được công bố. Số liệu máy host được ghi rõ và
        không đại diện cho phần tài nguyên riêng của ứng dụng. Dung lượng
        filesystem không phải hạn mức ổ đĩa của gói hosting; hạn mức không được
        nhà cung cấp công bố sẽ hiển thị không có dữ liệu. Di chuột vào dung
        lượng để xem số byte gốc.
      </p>
    </section>
  )
}
