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
