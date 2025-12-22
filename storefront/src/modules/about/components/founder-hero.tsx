"use client"

import React from "react"
import Image from "next/image"

type FounderHeroProps = {
  name: string
  title?: string
  quote: string
  imageSrc: string
  imageAlt?: string
}

const FounderHero: React.FC<FounderHeroProps> = ({
  name,
  title = "Founder",
  quote,
  imageSrc,
  imageAlt = "Founder portrait",
}) => {
  const [loaded, setLoaded] = React.useState(false)

  return (
    <section className="w-full">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <p className="text-small-regular text-ui-fg-subtle">{title}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Meet {name}
            </h1>

            <blockquote className="mt-6 border-l-4 border-[#005198] pl-4">
              <p className="text-base leading-relaxed text-ui-fg-base md:text-lg">
                “{quote}”
              </p>
              <footer className="mt-3 text-small-regular text-ui-fg-subtle">
                — {name}
              </footer>
            </blockquote>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/store"
                className="inline-flex items-center justify-center rounded-md bg-[#005198] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#034c8c]"
              >
                Shop Bioteem
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-md border border-ui-border-base px-5 py-3 text-sm font-medium text-ui-fg-base transition hover:bg-ui-bg-subtle"
              >
                Contact us
              </a>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-ui-bg-subtle shadow-soft">
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className={[
                  "object-cover transition duration-700 ease-out",
                  loaded ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-md scale-[1.02]",
                ].join(" ")}
                onLoadingComplete={() => setLoaded(true)}
              />
            </div>

            <p className="mt-3 text-xs text-ui-fg-subtle">
              Real people. Real science. Real results.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FounderHero
