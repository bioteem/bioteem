// src/modules/products/components/product-triple-info.tsx
"use client"

import React from "react"
import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import { Container, clx } from "@medusajs/ui"

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
      <Container className="px-0">
        {/* Header row (optional vibe alignment) */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-ui-fg-muted">
            At a glance
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {template.columns.map((col, idx) => (
            <div
              key={idx}
              className={clx(
                "rounded-2xl border border-ui-border-base bg-ui-bg-subtle p-6",
                "shadow-elevation-card-rest hover:shadow-elevation-card-hover transition-shadow"
              )}
            >
              <h3 className="text-xl md:text-2xl font-semibold text-ui-fg-base">
                {col.title}
              </h3>

              <ul className="mt-5 space-y-3">
                {col.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    {/* Dot */}
                    <span
                      aria-hidden
                      className={clx(
                        "mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full",
                        item.highlight ? "bg-[#E24B7A]" : "bg-ui-fg-muted"
                      )}
                    />
                    {/* Text */}
                    <p
                      className={clx(
                        "text-sm md:text-[15px] leading-relaxed",
                        item.highlight
                          ? "text-[#E24B7A] font-medium"
                          : "text-ui-fg-subtle"
                      )}
                    >
                      {item.text}
                    </p>
                  </li>
                ))}
              </ul>

              {/* Footer (badge) */}
              {col.footerKey === "cdhf" && (
                <div className="mt-6 pt-5 border-t border-ui-border-base">
                  <div className="flex items-center gap-3">
                    <Image
                      // IMPORTANT: use a real path + extension in /public
                      // e.g. /public/assets/cdhf.png  -> src="/assets/cdhf.png"
                      src="/assets/cdhf.png"
                      alt="CDHF Certified"
                      width={220}
                      height={90}
                      className="h-10 md:h-12 w-auto"
                    />
                    <span className="text-xs text-ui-fg-muted">
                      Certified
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

export default ProductTripleInfo
