// src/modules/products/components/product-triple-info.tsx
"use client"

import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { clx } from "@medusajs/ui"

import {
  TRIPLE_INFO_TEMPLATES,
  type TripleInfoTemplateId,
} from "@modules/products/constants/triple-info-templates"

type ProductTripleInfoProps = {
  product: HttpTypes.StoreProduct
}

/**
 * Chooses a Triple Info template based on product.metadata.triple_info_template
 *
 * In Admin → Product → Metadata, set:
 *   Key: triple_info_template
 *   Value: "general" | "skin" | "gut" | "energy"
 */
const ProductTripleInfo: React.FC<ProductTripleInfoProps> = ({ product }) => {
  const templateKey = product.metadata?.triple_info_template as
    | TripleInfoTemplateId
    | undefined

  if (!templateKey) return null

  const template = TRIPLE_INFO_TEMPLATES[templateKey]
  if (!template) return null

  return (
    <section className="mt-16">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-14">
        {template.columns.map((col, idx) => (
          <div key={idx}>
            <h3 className="text-2xl md:text-3xl font-semibold text-[#0B3A76]">
              {col.title}
            </h3>

            <ul className="mt-6 space-y-3">
              {col.items.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className={clx(
                      "mt-[0.55rem] h-[6px] w-[6px] rounded-full",
                      item.highlight ? "bg-[#E24B7A]" : "bg-ui-fg-muted"
                    )}
                  />
                  <p
                    className={clx(
                      "text-base leading-relaxed",
                      item.highlight
                        ? "text-[#E24B7A]"
                        : "text-ui-fg-subtle"
                    )}
                  >
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>

            {col.footerKey === "cdhf" && (
              <div className="mt-8">
                <Image
                  src="/assets/cdhf"
                  alt="CDHF Certified"
                  width={220}
                  height={90}
                  className="h-14 md:h-16 w-auto"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default ProductTripleInfo
