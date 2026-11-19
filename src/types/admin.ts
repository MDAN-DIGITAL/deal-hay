import type { User } from "@/types/auth"
import type { Ticket, TicketUser } from "@/types/ticket"

export type AdminOverviewResponse = {
  users: number
  shops: number
  locked_shops: number
  categories: number
  active_categories: number
  pending_tickets: number
  recent_tickets: Array<
    Pick<Ticket, "id" | "type_label" | "created_at"> & {
      user_name: string | null
    }
  >
}

export type AdminShopOnlineStatus = {
  is_online: boolean
  label: string
  last_activity_at: number | null
}

export type AdminShopCategory = {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export type AdminShopProduct = {
  id: string
  name: string
  category: string
  description: string | null
  price: number
  stock: number
  image_url: string | null
  is_active: boolean
}

export type AdminShopChangeLog = {
  id: string
  changes: Record<
    string,
    {
      label: string
      old: string | number | boolean | null
      new: string | number | boolean | null
    }
  >
  created_at: string | null
}

export type AdminShop = {
  id: string
  user_code: string
  full_name: string
  shop_name: string | null
  email: string
  shop_email: string | null
  avatar_url: string | null
  shop_avatar_url: string | null
  is_active: boolean
  lock_reason: string | null
  products_count: number
  online_status: AdminShopOnlineStatus
}

export type AdminShopDetails = AdminShop & {
  phone_number: string | null
  shop_phone_number: string | null
  personal_address: string
  shop_address: string
  change_logs_count: number
  created_at: string | null
  updated_at: string | null
  categories?: AdminShopCategory[]
  products?: AdminShopProduct[]
  change_logs?: AdminShopChangeLog[]
}

export type ProductCategory = {
  id: string
  name: string
  is_active: boolean
  products_count: number
  shops_count: number
}

export type AdminUsersResponse = {
  users: import("@/types/common").PaginatedResponse<User>
}
export type AdminShopsResponse = {
  shops: import("@/types/common").PaginatedResponse<AdminShop>
}
export type AdminShopDetailResponse = { selectedShop: AdminShopDetails }
export type AdminTicketSummary = Pick<
  Ticket,
  "id" | "type_label" | "source_label" | "status" | "created_at"
> & { user: Pick<TicketUser, "full_name" | "email"> | null }
export type AdminTicketsResponse = {
  tickets: import("@/types/common").PaginatedResponse<AdminTicketSummary>
}
export type AdminTicketDetailResponse = { selectedTicket: Ticket }
export type AdminCategoriesResponse = { categories: ProductCategory[] }
