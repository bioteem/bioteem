"use client"

import React from "react"
import Image from "next/image"
import SplitSection from "@modules/layout/components/split"

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
    <section>

    //   <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
    //     <div className="grid items-center gap-10 md:grid-cols-2">
    //       <div className="order-2 md:order-1">
    //         <p className="text-small-regular text-ui-fg-subtle">{title}</p>
    //         <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
    //           Meet {name}
    //         </h1>

    //         <blockquote className="mt-6 border-l-4 border-[#005198] pl-4">
    //           <p className="text-base leading-relaxed text-ui-fg-base md:text-lg italic">
    //             “{quote}”
    //           </p>
    //           <footer className="mt-3 text-small-regular text-ui-fg-subtle">
    //             — {name}
    //           </footer>
    //         </blockquote>
    //       </div>


    //         <p className="mt-3 text-xs text-ui-fg-subtle">
    //           Real people. Real science. Real results.
    //         </p>
    //     </div>
    //   </div>

      <SplitSection

        eyebrow="A word from our Founder"
        title={`Meet ${name}`}
        body={quote}
        imageSrc={imageSrc}
        imageAlt={imageAlt}
          variant="portrait"
  blockquote
  quoteAuthor={`${name}, Founder`}

>
      </SplitSection>
    </section>
  )
}

export default FounderHero
