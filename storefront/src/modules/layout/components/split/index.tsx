"use client"

import Image from "next/image"
import type { ReactNode } from "react"
import { Heading } from "@medusajs/ui"

type SplitSectionProps = {
  title: string
  body: string
  imageSrc: string
  imageAlt: string
  /** If true, image appears on the left on large screens */
  imageOnLeft?: boolean
  /** Small label above the title (optional) */
  eyebrow?: string
  /** Optional extra content under the text (buttons, links, etc.) */
  children?: ReactNode
}

const SplitSection = ({
  title,
  body,
  imageSrc,
  imageAlt,
  imageOnLeft = false,
  eyebrow,
  children,
}: SplitSectionProps) => {
  const textBlock = (
    <div className="space-y-4">
      {eyebrow && (
        <p className="text-xs tracking-[0.2em] uppercase text-ui-fg-muted">
          {eyebrow}
        </p>
      )}
      <Heading
        level="h2"
        className="text-2xl md:text-3xl font-normal text-ui-fg-base"
      >
        {title}
      </Heading>
      <p className="text-sm md:text-base text-ui-fg-subtle leading-relaxed">
        {body}
      </p>
      {children && <div className="pt-2">{children}</div>}
    </div>
  )

  const imageBlock = (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-ui-bg-subtle">
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        className="object-cover"
        sizes="(min-width: 1024px) 540px, 100vw"
      />
    </div>
  )

  return (
    <section className="w-full py-12 md:py-16">
      <div className="mx-auto flex max-w-6xl px-4 md:px-6">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          {imageOnLeft ? (
            <>
              {imageBlock}
              {textBlock}
            </>
          ) : (
            <>
              {textBlock}
              {imageBlock}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default SplitSection