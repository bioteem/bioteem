"use client"

import { Button } from "@medusajs/ui"
import { isEqual } from "lodash"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import { useIntersection } from "@lib/hooks/use-in-view"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"

import MobileActions from "./mobile-actions"
import ProductPrice from "../product-price"
import { addToCart } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"

type SubscriptionPlan = {
  id: string
  name: string
  interval: "day" | "week" | "month" | "year" | null
  interval_count: number | null
  unit_amount: number | null // cents
  currency: string | null    // "usd", "cad", ...
  payment_link_url: string | null
}

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
  subscriptionPlans?: SubscriptionPlan[]  // 👈 add this
}

const optionsAsKeymap = (variantOptions: any) => {
  return variantOptions?.reduce((acc: Record<string, string | undefined>, varopt: any) => {
    if (varopt.option && varopt.value !== null && varopt.value !== undefined) {
      acc[varopt.option.title] = varopt.value
    }
    return acc
  }, {})
}
const formatInterval = (
  interval: SubscriptionPlan["interval"],
  count: SubscriptionPlan["interval_count"]
) => {
  if (!interval) return "Recurring"
  const n = count ?? 1
  const unit = n === 1 ? interval : `${interval}s`
  return `Every ${n} ${unit}`
}

const formatPlanPrice = (plan: SubscriptionPlan, region: HttpTypes.StoreRegion) => {
  if (plan.unit_amount == null) return ""
  const currency = (plan.currency ?? region.currency_code ?? "usd").toUpperCase()

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(plan.unit_amount / 100)
}
export default function ProductActions({
  product,
  region,
  disabled,
  subscriptionPlans,
}: ProductActionsProps) {
  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const countryCode = useParams().countryCode as string

  // If there is only 1 variant, preselect the options
  useEffect(() => {
    if (product.variants?.length === 1) {
      const variantOptions = optionsAsKeymap(product.variants[0].options)
      setOptions(variantOptions ?? {})
    }
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (title: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [title]: value,
    }))
  }

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If we don't manage inventory, we can always add to cart
    if (selectedVariant && !selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant?.allow_backorder) {
      return true
    }

    // If there is inventory available, we can add to cart
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant])

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)

    await addToCart({
      variantId: selectedVariant.id,
      quantity: 1,
      countryCode,
    })

    setIsAdding(false)
  }

  return (
    <>
      <div className="flex flex-col gap-y-2" ref={actionsRef}>
        <div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4">
              {(product.options || []).map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.title ?? ""]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                    />
                  </div>
                )
              })}
              <Divider />
            </div>
          )}
        </div>

        <ProductPrice product={product} variant={selectedVariant} />

        <Button
          onClick={handleAddToCart}
          disabled={!inStock || !selectedVariant || !!disabled || isAdding}
          variant="primary"
          className="w-full h-10"
          isLoading={isAdding}
          data-testid="add-product-button"
        >
          {!selectedVariant
            ? "Select variant"
            : !inStock
            ? "Out of stock"
            : "Add to cart"}
        </Button>

        {/* 👇 Subscription plans section */}
        {subscriptionPlans && subscriptionPlans.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold">
              Subscribe &amp; save
            </h3>

            <div className="flex flex-col gap-3">
              {subscriptionPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {plan.name}
                    </span>
                    <span className="text-xs text-gray-600">
                      {formatInterval(plan.interval, plan.interval_count)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {plan.unit_amount != null && (
                      <span className="text-sm font-semibold">
                        {formatPlanPrice(plan, region)}
                      </span>
                    )}

                    {plan.payment_link_url && (
                      <Button
                        size="small"
                        variant="secondary"
                        className="whitespace-nowrap"
                        asChild
                      >
                        <a
                          href={plan.payment_link_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Subscribe
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={inStock}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
        />
      </div>
    </>
  )
}
