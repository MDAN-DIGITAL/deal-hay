import { clearAuthSession } from "@/lib/auth"
import { getSessionId } from "@/lib/session"

import { env } from "@/config/env"
import type { ValidationErrors } from "@/types/common"

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type SearchValue = string | number | boolean | null | undefined

export type ApiRequestOptions = {
  method?: ApiMethod
  path: string
  searchParams?: Record<string, SearchValue>
  body?: BodyInit | Record<string, unknown> | undefined
  headers?: HeadersInit
  credentials?: "include" | "omit"
  expectedSession?: string
  cache?: RequestCache
  next?: NextFetchRequestConfig
  signal?: AbortSignal
}

type ApiErrorPayload = {
  message?: string
  errors?: ValidationErrors
  [key: string]: unknown
}

export const API_UNAVAILABLE_MESSAGE =
  "Hệ thống đang tạm gián đoạn. Vui lòng thử lại sau ít phút."

export class ApiError extends Error {
  status: number
  errors?: ValidationErrors
  payload: ApiErrorPayload

  constructor(status: number, payload: ApiErrorPayload) {
    super(
      status >= 500
        ? API_UNAVAILABLE_MESSAGE
        : (payload.message ?? "Yêu cầu thất bại.")
    )
    this.status = status
    this.errors = payload.errors
    this.payload = payload
  }
}

function toQueryString(searchParams?: Record<string, SearchValue>): string {
  if (!searchParams) return ""
  const query = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    query.set(key, String(value))
  })
  const result = query.toString()
  return result ? `?${result}` : ""
}

function isFormData(value: ApiRequestOptions["body"]): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData
}

function readCsrfCookie(): string | undefined {
  const value = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("XSRF-TOKEN="))
    ?.slice("XSRF-TOKEN=".length)
  return value ? decodeURIComponent(value) : undefined
}

let csrfRequest: Promise<void> | undefined

async function csrfToken(refresh = false): Promise<string> {
  const current = readCsrfCookie()
  if (current && !refresh) return current
  csrfRequest ??= fetch(new URL("/sanctum/csrf-cookie", env.API_URL), {
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    headers: { Accept: "application/json" },
  })
    .then((response) => {
      if (!response.ok) throw new ApiError(response.status, {})
    })
    .finally(() => {
      csrfRequest = undefined
    })
  await csrfRequest
  const token = readCsrfCookie()
  if (!token)
    throw new ApiError(419, {
      message: "Trình duyệt không nhận được cookie bảo mật.",
    })
  return token
}

export async function apiFetch<T>({
  method = "GET",
  path,
  searchParams,
  body,
  headers,
  credentials = typeof document === "undefined" ? "omit" : "include",
  expectedSession,
  cache = "no-store",
  next,
  signal,
}: ApiRequestOptions): Promise<T> {
  const session =
    credentials === "include" ? (expectedSession ?? getSessionId()) : null
  const requestHeaders = new Headers(headers)
  const url = `${env.API_URL}${path}${toQueryString(searchParams)}`

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json")
  }

  const needsCsrf = credentials === "include" && method !== "GET"
  if (needsCsrf) {
    requestHeaders.set("X-XSRF-TOKEN", await csrfToken())
    if (session) {
      if (getSessionId() !== session)
        throw new ApiError(409, { message: "Phiên đăng nhập đã thay đổi." })
      requestHeaders.set("X-Dealhay-Session", session)
    }
  }

  let requestBody: BodyInit | undefined
  if (body !== undefined) {
    if (
      isFormData(body) ||
      typeof body === "string" ||
      body instanceof URLSearchParams ||
      body instanceof Blob
    ) {
      requestBody = body
    } else {
      requestHeaders.set("Content-Type", "application/json")
      requestBody = JSON.stringify(body)
    }
  }

  const send = () =>
    fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      cache,
      next,
      redirect: "error",
      credentials,
      signal,
    })
  let response = await send()
  if (
    response.status === 419 &&
    needsCsrf &&
    getSessionId() === session &&
    !signal?.aborted
  ) {
    requestHeaders.set("X-XSRF-TOKEN", await csrfToken(true))
    if (getSessionId() === session) response = await send()
  }

  const contentType = response.headers.get("content-type") ?? ""
  const isJson = contentType.includes("application/json")

  if (!response.ok) {
    const payload: ApiErrorPayload | undefined = isJson
      ? await response.json().catch(() => undefined)
      : undefined
    if (response.status === 401 && credentials === "include" && session)
      clearAuthSession(session)
    throw new ApiError(
      response.status,
      payload ?? { message: response.statusText }
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (isJson) {
    return (await response.json()) as T
  }

  return (await response.text()) as T
}
