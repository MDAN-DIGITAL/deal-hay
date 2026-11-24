export const catalogRoutes = {
  home: "/",
  shops: "/shops",
  shop: (shopUserCode: string) => `/shops/${shopUserCode}`,
  product: (shopUserCode: string, productSlug: string) =>
    `/shops/${shopUserCode}/products/${productSlug}`,
  follow: (shopUserCode: string) => `/shops/${shopUserCode}/follow`,
  reaction: (shopUserCode: string) => `/shops/${shopUserCode}/reaction`,
  review: (shopUserCode: string, productSlug: string) =>
    `/shops/${shopUserCode}/products/${productSlug}/review`,
  reviewReply: (reviewId: string) => `/shop/reviews/${reviewId}/reply`,
} as const
