export function storageUploadUrl(value: string): URL {
  const url = new URL(value)
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error("Địa chỉ tải ảnh không hợp lệ.")
  }
  return url
}
