import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import SplitSection from "@modules/layout/components/split"
import FullWidthVideoSection from "@modules/layout/components/video-section"
import { getCollectionsWithProducts } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { Button } from "@medusajs/ui"

export const metadata: Metadata = {
  title: "Bioteem40",
  description:
    "Probiotics that nourish you",
}

export default async function Home({
  params: { countryCode },
}: {
  params: { countryCode: string }
}) {
  const collections = await getCollectionsWithProducts(countryCode)
  const region = await getRegion(countryCode)

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero />
      <SplitSection
        imageOnLeft
        eyebrow="Science-backed"
        title="The most advanced supplement delivery."
        body="Designed to nourish your whole body, starting in your gut. We've developed a biological 'onion' (layers of nutrients) powered by over 30 diverse probiotic strains so you get the best results from your supplementation. Better gut health. Better absorption. Better you."
        imageSrc="/assets/products-vt.jpg"
        imageAlt="Lab glassware with capsules"
      ><Button className="bg-[#4e7ec7] hover:bg-[#1e55a8] text-white" size="large" asChild>
          <a href="/about">Learn more</a>
        </Button></SplitSection>
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
      <FullWidthVideoSection
  title="How Bioteem 40 Works"
  description="A quick walkthrough of what makes our formula effective and how it supports gut balance every day."
  videoSrc="/assets/full-product-video.mp4"
  posterSrc="/assets/video-poster.jpg"
  captionsSrc="/assets/full-product-video.mp4"
  transcript="This video explains how Bioteem 40 supports digestive wellness..."
/>
    </>
  )
}
