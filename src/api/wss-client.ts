import { ApiError } from "@/api/client"
import { getSessionId } from "@/lib/session"
import { clearWssSession, getWssSession } from "@/lib/wss-session"
import type { ApiRequestOptions } from "@/api/client"

export function wssFetch<T>(
  options: ApiRequestOptions,
  isCurrent?: () => boolean
): Promise<T> {
  const sessionId = getSessionId()
  return requestWss<T>(
    options,
    true,
    () => getSessionId() === sessionId && (isCurrent?.() ?? true)
  )
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
  isCurrent: () => boolean
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path))
    throw new Error("Invalid WSS request path")
  if (!isCurrent()) throw new Error("Phiên đăng nhập đã thay đổi.")
  const session = await getWssSession()
  if (!isCurrent()) throw new Error("Phiên đăng nhập đã thay đổi.")
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams ?? {}))
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value))
  const queryString = query.toString()
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
    `${session.url}${path}${queryString ? `?${queryString}` : ""}`,
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
  if (!isCurrent()) throw new Error("Phiên đăng nhập đã thay đổi.")
  if (!response.ok) {
    if (response.status === 401) {
      clearWssSession(session.token)
      if (renewSession && !signal?.aborted) {
        // A scoped ticket can expire while the browser session is still active.
        return requestWss<T>(
          { path, method, body, headers, searchParams, signal },
          false,
          isCurrent
        )
      }
    }
    throw new ApiError(response.status, {
      ...data,
      message: data.message ?? "Không thể xử lý yêu cầu. Vui lòng thử lại.",
    })
  }
  return data as T
}
