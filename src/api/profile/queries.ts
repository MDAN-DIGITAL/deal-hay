import { apiFetch } from "@/api/client"
import { profileRoutes } from "@/api/profile/routes"
import type {
  ProductInterestsResponse,
  ProfileResponse,
  ShopManageResponse,
} from "@/api/profile/types"

export function getProfile(): Promise<ProfileResponse> {
  return apiFetch({ path: profileRoutes.me })
}

export function getProductInterests(): Promise<ProductInterestsResponse> {
  return apiFetch({ path: profileRoutes.interests })
}

export function getShopManage(section: string): Promise<ShopManageResponse> {
  return apiFetch({ path: profileRoutes.shopManage, searchParams: { section } })
}
