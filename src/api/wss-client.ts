import { ApiError } from "@/api/client"
import { clearWssSession, getWssSession } from "@/lib/wss-session"
import type { ApiRequestOptions } from "@/api/client"

export function wssFetch<T>(
  options: ApiRequestOptions,
  isCurrent?: () => boolean
): Promise<T> {
  return requestWss<T>(options, true, isCurrent)
}

async function requestWss<T>(
  {
    path,
    method = "GET",
    body,
    headers,
    searchParams,
    signal,
  }: ApiRequestOptions,
  renewSession: boolean,
  isCurrent?: () => boolean
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path))
    throw new Error("Invalid WSS request path")
  if (isCurrent && !isCurrent()) throw new Error("Phiên đăng nhập đã thay đổi.")
  const session = await getWssSession()
  if (isCurrent && !isCurrent()) throw new Error("Phiên đăng nhập đã thay đổi.")
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
      signal,
    }
  )
  const data =
    response.status === 204 ? {} : await response.json().catch(() => ({}))
  if (isCurrent && !isCurrent()) throw new Error("Phiên đăng nhập đã thay đổi.")
  if (!response.ok) {
    if (response.status === 401) {
      clearWssSession(session.token)
      if (renewSession && !signal?.aborted) {
        // A RAM database restart invalidates scoped WSS credentials. Bootstrap
        // once from the signed-in API account, without logging that account out.
        return requestWss<T>(
          { path, method, body, headers, searchParams, signal },
          false,
          isCurrent
        )
      }
    }
    throw new ApiError(response.status, {
      ...data,
      message:
        data.message ?? "Không thể xử lý yêu cầu chat. Vui lòng thử lại.",
    })
  }
  return data as T
}
