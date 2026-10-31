export type ImagePurpose = "avatar" | "product" | "review" | "chat"

export type ImageUploadSession = {
  token: string
  url: string
  headers: Record<string, string>
  asset_url: string
  expires_at?: string
}
