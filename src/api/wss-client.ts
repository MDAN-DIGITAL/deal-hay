import { ApiError } from "@/api/client"
import { clearWssSession, getWssSession } from "@/lib/wss-session"
import type { ApiRequestOptions } from "@/api/client"

export async function wssFetch<T>({
  path,
  method = "GET",
  body,
  headers,
  searchParams,
}: ApiRequestOptions): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path))
    throw new Error("Invalid WSS request path")
  const session = await getWssSession()
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams ?? {}))
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value))
  const requestHeaders = new Headers(headers)
  requestHeaders.set("Authorization", `Bearer ${session.token}`)
  requestHeaders.set("Accept", "application/json")
  let payload: BodyInit | undefined
  if (body !== undefined) {
    if (
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof URLSearchParams ||
      typeof body === "string"
    )
      payload = body
    else {
      requestHeaders.set("Content-Type", "application/json")
      payload = JSON.stringify(body)
    }
  }
  const response = await fetch(
    `${session.url}${path}${query.size ? `?${query}` : ""}`,
    {
      method,
      headers: requestHeaders,
      body: payload,
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    }
  )
  const data =
    response.status === 204 ? {} : await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) clearWssSession(session.token)
    throw new ApiError(response.status, {
      ...data,
      message:
        data.message ?? "Không thể xử lý yêu cầu chat. Vui lòng thử lại.",
    })
  }
  return data as T
}
