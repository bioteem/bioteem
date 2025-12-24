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

const ProductTripleInfo: React.FC<ProductTripleInfoProps> = ({ product }) => {
  const templateKey = product.metadata?.triple_info_template as
    | TripleInfoTemplateId
    | undefined

  if (!templateKey) return null

  const template = TRIPLE_INFO_TEMPLATES[templateKey]
  if (!template) return null

  return (
    /* 👇 SIDE MARGINS LIVE HERE */
    <section className="my-24 px-4 sm:px-6 lg:px-10">
      <Container>
        {/* Section label */}
        <p className="mb-6 text-xs uppercase tracking-[0.22em] text-ui-fg-muted">
          At a glance
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {template.columns.map((col, idx) => (
            <div
              key={idx}
              className={clx(
                "rounded-2xl bg-ui-bg-subtle",
                "border border-ui-border-base",
                "p-5 md:p-6", // 👈 reduced internal padding
                "shadow-sm hover:shadow-md transition-shadow"
              )}
            >
              {/* Title */}
              <h3 className="text-lg md:text-xl font-semibold text-ui-fg-base">
                {col.title}
              </h3>

              {/* List */}
              <ul className="mt-4 space-y-3">
                {col.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={clx(
                        "mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full",
                        item.highlight
                          ? "bg-[#E24B7A]"
                          : "bg-ui-fg-muted"
                      )}
                    />
                    <p
                      className={clx(
                        "text-sm leading-relaxed",
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

              {/* Footer badge */}
              {col.footerKey === "cdhf" && (
                <div className="mt-6 pt-4 border-t border-ui-border-base">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/assets/cdhf.png"
                      alt="CDHF Certified"
                      width={220}
                      height={90}
                      className="h-10 w-auto"
                    />
                    <span className="text-xs text-ui-fg-muted">
                      Digestive health certified
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
