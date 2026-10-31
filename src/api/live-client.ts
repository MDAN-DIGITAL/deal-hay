import { apiFetch, ApiError } from "@/api/client"
export { ApiError as LiveApiError }
export function liveApiFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH"
    body?: FormData | Record<string, unknown>
    headers?: HeadersInit
    searchParams?: Record<string, string | number | undefined>
  } = {}
): Promise<T> {
  return apiFetch<T>({ path, ...options })
}
