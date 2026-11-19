import { apiFetch } from "@/api/client"
import { adminRoutes } from "@/api/admin/routes"
import type {
  AdminCategoriesResponse,
  AdminOverviewResponse,
  AdminShopDetailResponse,
  AdminShopsResponse,
  AdminTicketDetailResponse,
  AdminTicketsResponse,
  AdminUsersResponse,
} from "@/types/admin"

export function getAdminOverview(): Promise<AdminOverviewResponse> {
  return apiFetch({ path: adminRoutes.overview })
}

export function getAdminUsers(
  page?: string,
  search?: string,
  role?: string,
  status?: string
): Promise<AdminUsersResponse> {
  return apiFetch({
    path: adminRoutes.users,
    searchParams: { page, search, role, status },
  })
}

export function getAdminShop(shopId: string): Promise<AdminShopDetailResponse> {
  return apiFetch({ path: adminRoutes.shop(encodeURIComponent(shopId)) })
}

export function getAdminTicket(
  ticketId: string
): Promise<AdminTicketDetailResponse> {
  return apiFetch({ path: adminRoutes.ticket(encodeURIComponent(ticketId)) })
}

export function getAdminShops(
  search?: string,
  status?: string,
  page?: string
): Promise<AdminShopsResponse> {
  return apiFetch({
    path: adminRoutes.shops,
    searchParams: { search, status, page },
  })
}

export function getAdminCategories(): Promise<AdminCategoriesResponse> {
  return apiFetch({ path: adminRoutes.categories })
}

export function getAdminTickets(
  type?: string,
  status?: string,
  source?: string,
  page?: string
): Promise<AdminTicketsResponse> {
  return apiFetch({
    path: adminRoutes.tickets,
    searchParams: { type, status, source, page },
  })
}
