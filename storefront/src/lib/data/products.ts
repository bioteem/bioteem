import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { cache } from "react"
import { getRegion } from "./regions"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { sortProducts } from "@lib/util/sort-products"
import { headers as nextHeaders } from "next/headers"
import { StoreProductReview } from "../../types/global"

export const getProductsById = cache(async function ({
  ids,
  regionId,
}: {
  ids: string[]
  regionId: string
}) {
  return sdk.store.product
    .list(
      {
        id: ids,
        region_id: regionId,
        fields: "*variants.calculated_price,+variants.inventory_quantity",
      },
      { next: { tags: ["products"] } }
    )
    .then(({ products }) => products)
})

export const getProductByHandle = cache(async function (
  handle: string,
  regionId: string
) {
  return sdk.store.product
    .list(
      {
        handle,
        region_id: regionId,
        fields: "*variants.calculated_price,+variants.inventory_quantity,+metadata",
      },
      { next: { tags: ["products"] } }
    )
    .then(({ products }) => products[0])
})

export const getProductsList = cache(async function ({
  pageParam = 1,
  queryParams,
  countryCode,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> {
  const limit = queryParams?.limit || 12
  const validPageParam = Math.max(pageParam, 1);
  const offset = (validPageParam - 1) * limit
  const region = await getRegion(countryCode)

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }
  return sdk.store.product
    .list(
      {
        limit,
        offset,
        region_id: region.id,
        fields: "*variants.calculated_price",
        ...queryParams,
      },
      { next: { tags: ["products"] } }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
})

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const getProductsListWithSort = cache(async function ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> {
  const limit = queryParams?.limit || 12

  const {
    response: { products, count },
  } = await getProductsList({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: 100,
    },
    countryCode,
  })

  const sortedProducts = sortProducts(products, sortBy)

  const pageParam = (page - 1) * limit

  const nextPage = count > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  }
})

/**
 * Fetch subscription plans for a given product id
 */export type SubscriptionPlan = {
  id: string
  name: string
  interval: "day" | "week" | "month" | "year" | null
  interval_count: number | null
  stripe_price_id: string
  payment_link_url: string | null
  unit_amount: number | null
  currency: string | null
  active: boolean
}

/**
 * Fetch subscription plans for a given product id
 */
export const getSubscriptionPlansForProduct = cache(async function (
  productId: string
): Promise<SubscriptionPlan[]> {
  try {
    const data = await sdk.client.fetch<{
      subscription_plans: SubscriptionPlan[]
    }>(`/store/products/${productId}/subscription-plans`, {
      method: "GET",
      next: { tags: ["subscription-plans", productId] },
    })

    return data.subscription_plans ?? []
  } catch (err) {
    console.error(
      "[storefront] Failed to fetch subscription plans for product",
      productId,
      err
    )

    return []
  }
})
export const getProductReviews = cache(async function ({
  productId,
  limit = 10,
  offset = 0,
}: {
  productId: string
  limit?: number
  offset?: number
}) {
  const headers = await getAuthHeaders()

  return sdk.client.fetch<{
    reviews: StoreProductReview[]
    average_rating: number
    limit: number
    offset: number
    count: number
  }>(`/store/products/${productId}/reviews`, {
    headers,
    query: {
      limit,
      offset,
      order: "-created_at",
    },
    next: await getCacheOptions(`product-reviews-${productId}`),
    cache: "force-cache",
  })
})

export const addProductReview = async (input: {
  title?: string
  content: string
  first_name: string
  last_name: string
  rating: number
  product_id: string
}) => {
  const headers = await getAuthHeaders()

  return sdk.client.fetch(`/store/reviews`, {
    method: "POST",
    headers,
    body: input,
    // mutation => no-store
    cache: "no-store",
  })
}

/**
 * Forward cookies/authorization from the incoming request to Medusa
 * so customer-authenticated endpoints work in Server Components / Route Handlers.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const h = nextHeaders()

  const cookie = h.get("cookie")
  const authorization = h.get("authorization")

  const out: Record<string, string> = {}
  if (cookie) out.cookie = cookie
  if (authorization) out.authorization = authorization

  return out
}

/**
 * Next.js cache tags for this request.
 * (Lets you later do revalidateTag(`product-reviews-${productId}`) after submission if needed.)
 */
async function getCacheOptions(tag: string): Promise<{ tags: string[] }> {
  return { tags: [tag] }
}