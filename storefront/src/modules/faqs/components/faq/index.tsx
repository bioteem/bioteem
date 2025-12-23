"use client"

import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { Text } from "@medusajs/ui"

type FaqItem = {
  q: string
  a: string
}

export default function Faq({
  items,
  defaultValue,
}: {
  items: FaqItem[]
  defaultValue?: string
}) {
  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      defaultValue={defaultValue}
      className="w-full"
    >
      {items.map((item, idx) => {
        const value = `item-${idx}`
        return (
          <AccordionPrimitive.Item
            key={value}
            value={value}
            className="border-ui-border-base border-b py-4"
          >
            <AccordionPrimitive.Header>
              <AccordionPrimitive.Trigger className="w-full text-left flex items-center justify-between gap-4">
                <Text className="text-ui-fg-base">{item.q}</Text>
                <span className="text-ui-fg-subtle text-lg leading-none">+</span>
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>

            <AccordionPrimitive.Content className="pt-3">
              <Text className="text-ui-fg-subtle">{item.a}</Text>
            </AccordionPrimitive.Content>
          </AccordionPrimitive.Item>
        )
      })}
    </AccordionPrimitive.Root>
  )
}
