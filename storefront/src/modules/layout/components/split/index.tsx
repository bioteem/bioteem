"use client"

import Image from "next/image"
import type { ReactNode } from "react"
import { Heading } from "@medusajs/ui"

type Variant = "default" | "portrait" | "stacked"

type SplitSectionProps = {
  title: string
  body: string
  imageSrc: string
  imageAlt: string

  imageOnLeft?: boolean
  eyebrow?: string
  children?: ReactNode

  blockquote?: boolean
  quoteAuthor?: string

  variant?: Variant
}

export default function SplitSection({
  title,
  body,
  imageSrc,
  imageAlt,
  imageOnLeft = false,
  eyebrow,
  children,
  blockquote = false,
  quoteAuthor,
  variant = "default",
}: SplitSectionProps) {
  const spacing =
    variant === "portrait" ? "gap-6 lg:gap-6" : "gap-8 lg:gap-10"

  const bodyBlock = blockquote ? (
    <blockquote className="mt-3 border-l-4 border-[#005198] pl-4">
      <p
        className={[
          "italic leading-relaxed text-ui-fg-base",
          variant === "portrait" ? "text-base md:text-lg" : "text-sm md:text-base",
        ].join(" ")}
      >
        “{body}”
      </p>
      {quoteAuthor && (
        <footer className="mt-2 text-sm text-ui-fg-subtle not-italic">
          — {quoteAuthor}
        </footer>
      )}
    </blockquote>
  ) : (
    <p
      className={[
        "leading-relaxed text-ui-fg-subtle",
      ].join(" ")}
    >
      {body}
    </p>
  )

  const textBlock = (
    <div
      className={[
        "space-y-4",
        variant === "portrait"
          ? "max-w-[800px] h-full flex flex-col justify-start lg:pt-10 lg:pr-6"
          : "",
      ].join(" ")}
    >
      {eyebrow && (
        <p className="text-xs tracking-[0.2em] uppercase text-ui-fg-muted">
          {eyebrow}
        </p>
      )}

      <Heading
        level="h2"
        className={[
          "text-ui-fg-base",
        ].join(" ")}
      >
        {title}
      </Heading>

      {bodyBlock}
      {children && <div className="pt-2">{children}</div>}
    </div>
  )

  const imageBlock =
    variant === "stacked" ? (
      <div className="relative w-full overflow-hidden rounded-3xl bg-ui-bg-subtle aspect-video">
        <Image src={imageSrc} alt={imageAlt} fill className="object-cover" sizes="100vw" />
      </div>
    ) : variant === "portrait" ? (
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-3xl bg-ui-bg-subtle aspect-[4/5]">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover object-[50%_20%]"
          sizes="(min-width: 1024px) 420px, 100vw"
        />
      </div>
    ) : (
      <div className="relative w-full overflow-hidden rounded-3xl bg-ui-bg-subtle aspect-[4/3]">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 540px, 100vw"
        />
      </div>
    )

const layoutWrapper =
  variant === "stacked" ? (
    <div className={["flex flex-col", spacing].join(" ")}>
      {imageBlock}
      {textBlock}
    </div>
  ) : (
    <div
      className={[
        "grid w-full grid-cols-1",
        spacing,

        // ✅ portrait: use content-sized columns and center the whole block
        variant === "portrait"
          ? "lg:grid-cols-[minmax(0,800px)_420px] lg:justify-center lg:items-start"
          : "lg:grid-cols-2 lg:items-center",
      ].join(" ")}
    >
      <>
  <div
    className={[
      // mobile: image first
      "order-1",
      // desktop: respect imageOnLeft
      imageOnLeft ? "lg:order-1" : "lg:order-2",
    ].join(" ")}
  >
    {imageBlock}
  </div>

  <div
    className={[
      // mobile: text second
      "order-2",
      imageOnLeft ? "lg:order-2" : "lg:order-1",
    ].join(" ")}
  >
    {textBlock}
  </div>
</>

    </div>
  )


  return (
    <section className="w-full py-12 md:py-16">
      <div className="mx-auto max-w-8xl px-4 md:px-6">{layoutWrapper}</div>
    </section>
  )
}
