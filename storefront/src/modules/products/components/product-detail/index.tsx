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
    <section className="my-24"> {/* 👈 generous vertical margins */}
      <Container className="px-0">
        {/* Section label */}
        <p className="mb-8 text-xs uppercase tracking-[0.22em] text-ui-fg-muted">
          At a glance
        </p>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {template.columns.map((col, idx) => (
            <div
              key={idx}
              className={clx(
                "relative rounded-3xl bg-ui-bg-subtle",
                "border border-ui-border-base",
                "p-8 md:p-10",
                "shadow-sm hover:shadow-md transition-shadow"
              )}
            >
              {/* Column title */}
              <h3 className="text-xl md:text-2xl font-semibold text-ui-fg-base">
                {col.title}
              </h3>

              {/* List */}
              <ul className="mt-6 space-y-4">
                {col.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-4">
                    {/* Bullet */}
                    <span
                      aria-hidden
                      className={clx(
                        "mt-[0.6rem] h-2 w-2 shrink-0 rounded-full",
                        item.highlight
                          ? "bg-[#E24B7A]"
                          : "bg-ui-fg-muted"
                      )}
                    />
                    {/* Text */}
                    <p
                      className={clx(
                        "text-sm md:text-base leading-relaxed",
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
                <div className="mt-10 pt-6 border-t border-ui-border-base">
                  <div className="flex items-center gap-4">
                    <Image
                      src="/assets/cdhf.png" // ensure correct path
                      alt="CDHF Certified"
                      width={220}
                      height={90}
                      className="h-11 md:h-12 w-auto"
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
