import { clearAccessToken, getAccessToken } from "@/lib/session"

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
  token?: string | null
  cache?: RequestCache
}

type ApiErrorPayload = {
  message?: string
  errors?: ValidationErrors
  [key: string]: unknown
}

export class ApiError extends Error {
  status: number
  errors?: ValidationErrors
  payload: ApiErrorPayload

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message ?? "Yêu cầu thất bại.")
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

export async function apiFetch<T>({
  method = "GET",
  path,
  searchParams,
  body,
  headers,
  token,
  cache = "no-store",
}: ApiRequestOptions): Promise<T> {
  const resolvedToken = token === undefined ? getAccessToken() : token
  const requestHeaders = new Headers(headers)
  const url = `${env.API_URL}${path}${toQueryString(searchParams)}`

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json")
  }

  if (resolvedToken) {
    requestHeaders.set("Authorization", `Bearer ${resolvedToken}`)
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

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
    cache,
    redirect: "error",
    credentials: "omit",
  })

  const contentType = response.headers.get("content-type") ?? ""
  const isJson = contentType.includes("application/json")
  const payload = isJson
    ? ((await response.json()) as ApiErrorPayload)
    : undefined

  if (!response.ok) {
    if (
      response.status === 401 &&
      resolvedToken &&
      getAccessToken() === resolvedToken
    )
      clearAccessToken()
    throw new ApiError(
      response.status,
      payload ?? { message: response.statusText }
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (isJson) {
    return payload as T
  }

  return (await response.text()) as T
}
