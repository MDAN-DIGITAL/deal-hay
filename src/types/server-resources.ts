export type ResourceScope = "container" | "host" | "unavailable"

/** Nullable fields mean the runtime cannot expose that measurement or limit. */
export type ServerResources = {
  sampled_at: string
  sample_window_ms: number | null
  instance_id: string
  cpu: {
    percent: number | null
    allocated_cores: number | null
    visible_logical_cores: number | null
    model: string | null
    scope: ResourceScope
    source: string
  }
  memory: {
    used_bytes: number | null
    limit_bytes: number | null
    available_bytes: number | null
    percent: number | null
    scope: ResourceScope
    source: string
  }
  disk: {
    used_bytes: number | null
    total_bytes: number | null
    available_bytes: number | null
    percent: number | null
    allocated_bytes: number | null
    scope: "filesystem" | "unavailable"
    source: string
  }
  os: {
    name: string | null
    platform: string
    release: string | null
    architecture: string | null
  }
  process: {
    rss_bytes: number | null
    uptime_seconds: number | null
  }
}
