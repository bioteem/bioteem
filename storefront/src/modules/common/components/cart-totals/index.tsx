"use client"

import { convertToLocale } from "@lib/util/money"
import { InformationCircleSolid } from "@medusajs/icons"
import { Tooltip } from "@medusajs/ui"
import React from "react"

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null

    item_subtotal?: number | null // ✅ add
    tax_total?: number | null

    shipping_subtotal?: number | null // ✅ add
    shipping_total?: number | null
    shipping_tax_total?: number | null // ✅ add (optional)

    discount_total?: number | null
    gift_card_total?: number | null
    currency_code: string
  }
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const {
    currency_code,
    total,
    subtotal,

    item_subtotal,
    tax_total,

    shipping_subtotal,
    shipping_total,
    shipping_tax_total,

    discount_total,
    gift_card_total,
  } = totals

  const itemsSubtotal = item_subtotal ?? 0
  const shippingPreTax = shipping_subtotal ?? null
  const shippingShown = shippingPreTax ?? (shipping_total ?? 0) // fallback

  return (
    <div>
      <div className="flex flex-col gap-y-2 txt-medium text-ui-fg-subtle ">
        <div className="flex items-center justify-between">
          <span className="flex gap-x-1 items-center">
            Subtotal (items)
          </span>
          <span data-testid="cart-subtotal" data-value={itemsSubtotal || 0}>
            {convertToLocale({ amount: itemsSubtotal ?? 0, currency_code })}
          </span>
        </div>

        {!!discount_total && (
          <div className="flex items-center justify-between">
            <span>Discount</span>
            <span
              className="text-ui-fg-interactive"
              data-testid="cart-discount"
              data-value={discount_total || 0}
            >
              - {convertToLocale({ amount: discount_total ?? 0, currency_code })}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="flex gap-x-1 items-center">
            Shipping
            {shippingPreTax !== null && shipping_tax_total ? (
              <Tooltip content="Shipping tax is included in the Taxes line below.">
                <InformationCircleSolid className="text-ui-fg-subtle" />
              </Tooltip>
            ) : null}
          </span>

          <span data-testid="cart-shipping" data-value={shippingShown || 0}>
            {convertToLocale({ amount: shippingShown ?? 0, currency_code })}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="flex gap-x-1 items-center ">
            Taxes
            <Tooltip content="Taxes may include tax on shipping, depending on your region.">
              <InformationCircleSolid className="text-ui-fg-subtle" />
            </Tooltip>
          </span>
          <span data-testid="cart-taxes" data-value={tax_total || 0}>
            {convertToLocale({ amount: tax_total ?? 0, currency_code })}
          </span>
        </div>

        {!!gift_card_total && (
          <div className="flex items-center justify-between">
            <span>Gift card</span>
            <span
              className="text-ui-fg-interactive"
              data-testid="cart-gift-card-amount"
              data-value={gift_card_total || 0}
            >
              - {convertToLocale({ amount: gift_card_total ?? 0, currency_code })}
            </span>
          </div>
        )}
      </div>

      <div className="h-px w-full border-b border-gray-200 my-4" />

      <div className="flex items-center justify-between text-ui-fg-base mb-2 txt-medium ">
        <span>Total</span>
        <span className="txt-xlarge-plus" data-testid="cart-total" data-value={total || 0}>
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </span>
      </div>

      <div className="h-px w-full border-b border-gray-200 mt-4" />
    </div>
  )
}

export default CartTotals