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

  /** Flip order on desktop for split layouts (default/portrait) */
  imageOnLeft?: boolean

  eyebrow?: string
  children?: ReactNode

  /** Render body as quote */
  blockquote?: boolean
  quoteAuthor?: string

  /** Layout style */
  variant?: Variant

  /** Optional overrides */
  imageAspect?: "4/3" | "4/5" | "1/1" | "16/9"
  imageMaxWidth?: number // only used in portrait variant (px)
  tight?: boolean // makes spacing closer
}

const aspectClass: Record<NonNullable<SplitSectionProps["imageAspect"]>, string> =
  {
    "4/3": "aspect-[4/3]",
    "4/5": "aspect-[4/5]",
    "1/1": "aspect-square",
    "16/9": "aspect-video",
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
  imageAspect,
  imageMaxWidth = 480,
  tight = false,
}: SplitSectionProps) {
  const spacing = tight ? "gap-6 lg:gap-8" : "gap-10 lg:gap-12"

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
        // In portrait variant, make text match the image height nicely
        variant === "portrait" ? "h-full flex flex-col justify-center" : "",
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

  // --- IMAGE BLOCKS PER VARIANT ---

  // Default: responsive aspect ratio, can get big on desktop but "normal"
  const defaultImageBlock = (
    <div
      className={[
        "relative w-full overflow-hidden rounded-3xl bg-ui-bg-subtle",
        aspectClass[imageAspect ?? "4/3"],
      ].join(" ")}
    >
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        className="object-cover"
        sizes="(min-width: 1024px) 540px, 100vw"
      />
    </div>
  )

  // Portrait: vertical image (4/5 by default) + capped width on desktop
  const portraitImageBlock = (
    <div className="w-full lg:flex lg:justify-end">
      <div
        className={[
          "relative w-full overflow-hidden rounded-3xl bg-ui-bg-subtle",
          aspectClass[imageAspect ?? "4/5"],
        ].join(" ")}
        style={{ maxWidth: imageMaxWidth }}
      >
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover object-[50%_20%]"
          sizes={`(min-width: 1024px) ${imageMaxWidth}px, 100vw`}
        />
      </div>
    </div>
  )

  // Stacked: image on top, text below, even on desktop
  const stackedImageBlock = (
    <div
      className={[
        "relative w-full overflow-hidden rounded-3xl bg-ui-bg-subtle",
        aspectClass[imageAspect ?? "16/9"],
      ].join(" ")}
    >
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        className="object-cover"
        sizes="100vw"
      />
    </div>
  )

  const imageBlock =
    variant === "portrait"
      ? portraitImageBlock
      : variant === "stacked"
        ? stackedImageBlock
        : defaultImageBlock

  // --- LAYOUT WRAPPER PER VARIANT ---

  const layoutWrapper =
    variant === "stacked" ? (
      <div className={["flex flex-col", spacing].join(" ")}>
        {imageBlock}
        {textBlock}
      </div>
    ) : (
      <div
        className={[
          "grid w-full grid-cols-1 lg:grid-cols-2",
          spacing,
          // portrait: stretch so text can match image height
          variant === "portrait" ? "lg:items-stretch" : "lg:items-center",
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
    )

  return (
    <section className="w-full py-12 md:py-16">
      <div className="mx-auto flex max-w-8xl px-4 md:px-6">
        {layoutWrapper}
      </div>
    </section>
  )
}
