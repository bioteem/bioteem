"use client"

import Faq from "../../../faqs/components/faq"
import { FAQ_TEMPLATES, type FaqItem } from "../../constants/faq-template"

type ProductLike = {
  metadata?: Record<string, any> | null
}

type Props = {
  product: ProductLike | null | undefined
  fallbackTemplateKey?: keyof typeof FAQ_TEMPLATES
  hideIfNoMatch?: boolean
}

function getTemplateKey(value: unknown): string | null {
  if (typeof value === "string") {
    const v = value.trim()
    return v.length ? v : null
  }
  return null
}

export default function ProductFaq({
  product,
  fallbackTemplateKey = "default",
  hideIfNoMatch = false,
}: Props) {
  const templateKey = getTemplateKey(product?.metadata?.faq_template)

  const items: FaqItem[] | undefined =
    (templateKey && FAQ_TEMPLATES[templateKey]) ||
    FAQ_TEMPLATES[fallbackTemplateKey]

  if (!items?.length) {
    return hideIfNoMatch ? null : null
  }

  return <Faq items={items} />
}