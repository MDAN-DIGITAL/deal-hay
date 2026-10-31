export type SpeedtestPhase =
  | "idle"
  | "connecting"
  | "ping"
  | "download"
  | "upload"
  | "complete"
  | "error"
  | "cancelled"

export type SpeedSample = { elapsedMs: number; mbps: number }

export type SpeedtestTarget = "backend" | "wss"

export type SpeedtestState = {
  phase: SpeedtestPhase
  progress: number
  pingMs: number | null
  jitterMs: number | null
  downloadMbps: number | null
  uploadMbps: number | null
  liveMbps: number | null
  samples: { download: SpeedSample[]; upload: SpeedSample[] }
  serverName: "DealHay Backend" | "DealHay WSS" | null
  completedAt: string | null
  elapsedMs: number
  transferredBytes: number
  error: string | null
}

export type SpeedtestSession = {
  target?: SpeedtestTarget
  token: string
  endpointUrl: string
  expiresAt: string
  limits: {
    max_download_bytes: number
    max_upload_bytes: number
    max_session_bytes: number
    max_requests: number
  }
}

export type SpeedtestSessionResult =
  | { success: true; data: SpeedtestSession }
  | { success: false; message: string }
