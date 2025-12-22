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

  /**
   * "center" = your current behavior
   * "match-image" = image defines height; text column stretches to match image height
   */
  layout?: "center" | "match-image"

  imageAspect?: "4/3" | "4/5" | "1/1" | "16/9"

  /** If true, render the body as a styled blockquote */
  blockquote?: boolean
  /** Optional author line under the quoted body */
  quoteAuthor?: string
}

const aspectClass: Record<
  NonNullable<SplitSectionProps["imageAspect"]>,
  string
> = {
  "4/3": "aspect-[4/3]",
  "4/5": "aspect-[4/5]",
  "1/1": "aspect-square",
  "16/9": "aspect-video",
}

const SplitSection = ({
  title,
  body,
  imageSrc,
  imageAlt,
  imageOnLeft = false,
  eyebrow,
  children,
  layout = "center",
  imageAspect = "4/3",
  blockquote = false,
  quoteAuthor,
}: SplitSectionProps) => {
  const bodyBlock = blockquote ? (
    <blockquote className="mt-4 border-l-4 border-[#005198] pl-4">
      <p className="text-sm md:text-base leading-relaxed text-ui-fg-base italic">
        “{body}”
      </p>
      {quoteAuthor && (
        <footer className="mt-2 text-sm text-ui-fg-subtle not-italic">
          — {quoteAuthor}
        </footer>
      )}
    </blockquote>
  ) : (
    <p className="text-sm md:text-base text-ui-fg-subtle leading-relaxed">
      {body}
    </p>
  )

  const textBlock = (
    <div
      className={[
        "space-y-4",
        layout === "match-image" ? "h-full flex flex-col justify-center" : "",
      ].join(" ")}
    >
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

      {bodyBlock}

      {children && <div className="pt-2">{children}</div>}
    </div>
  )

 const imageBlock = (
  <div
    className={[
      "relative w-full overflow-hidden rounded-3xl bg-ui-bg-subtle",
      // Mobile/tablet: keep nice aspect ratio
      "aspect-[4/3]",
      // Desktop: stop it from becoming huge
      "lg:aspect-auto lg:h-[520px] xl:h-[580px]",
    ].join(" ")}
  >
    <Image
      src={imageSrc}
      alt={imageAlt}
      fill
      className="object-cover object-[50%_20%]"
      sizes="(min-width: 1024px) 540px, 100vw"
      priority={false}
    />
  </div>
)


  return (
    <section className="w-full py-12 md:py-16">
      <div className="mx-auto flex max-w-8xl px-4 md:px-6">
        <div
  className={[
    "grid w-full grid-cols-1 gap-10 lg:grid-cols-2",
    layout === "match-image" ? "lg:items-stretch" : "lg:items-center",
  ].join(" ")}
>

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
