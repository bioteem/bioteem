"use client"

import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { Text } from "@medusajs/ui"

type FaqItem = {
  q: string
  a: string
}

export default function Faq({ items }: { items: FaqItem[] }) {
  return (
    <AccordionPrimitive.Root type="single" collapsible className="w-full">
      {items.map((item, idx) => {
        const value = `item-${idx}`

        return (
          <AccordionPrimitive.Item
            key={value}
            value={value}
            className="border-ui-border-base border-b py-4"
          >
            <AccordionPrimitive.Header>
              {/* Trigger gets data-state="open|closed" */}
              <AccordionPrimitive.Trigger className="group w-full text-left flex items-center justify-between gap-4">
                <Text className="text-ui-fg-base">{item.q}</Text>

                <span className="relative w-5 h-5 flex items-center justify-center">
                  {/* Plus when CLOSED */}
                  <span className="block group-data-[state=open]:hidden text-ui-fg-subtle text-lg leading-none">
                    +
                  </span>
                  {/* Minus when OPEN */}
                  <span className="hidden group-data-[state=open]:block text-ui-fg-subtle text-lg leading-none">
                    −
                  </span>
                </span>
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
