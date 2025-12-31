import { getProductsById } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductActions from "@modules/products/components/product-actions"
import type { SubscriptionPlan } from "@lib/data/products" // 👈 add this
import TrustBadges from "@modules/products/components/trust-badge"

/**
 * Fetches real time pricing for a product and renders the product actions component.
 */
export default async function ProductActionsWrapper({
  id,
  region,
  subscriptionPlans,                      // 👈 accept plans
}: {
  id: string
  region: HttpTypes.StoreRegion
  subscriptionPlans?: SubscriptionPlan[]  // 👈 typed prop
}) {
  const [product] = await getProductsById({
    ids: [id],
    regionId: region.id,
  })

  if (!product) {
    return null
  }

  return (
    <div>
    <ProductActions
      product={product}
      region={region}
      subscriptionPlans={subscriptionPlans}  // 👈 pass them down
    />
    <TrustBadges className="mt-6" />
    </div>
  )
}