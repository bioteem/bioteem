import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import SplitSection from "@modules/layout/components/split"
import FullWidthVideoSection from "@modules/layout/components/video-section"
import { getCollectionsWithProducts } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import CTAButton from "@modules/common/components/call-to-action-btn"

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


      {/* First splitsection */}
      <SplitSection
        imageOnLeft
        eyebrow="Science-backed"
        title="The most advanced supplement delivery."
        body="Designed to nourish your whole body, starting in your gut. We've developed a biological 'onion' (layers of nutrients) powered by over 30 diverse probiotic strains so you get the best results from your supplementation. Better gut health. Better absorption. Better you."
        imageSrc="/assets/products-vt.jpg"
        imageAlt="Lab glassware with capsules"
      >
       <CTAButton href="/store" variant="primary">
  Shop Now
</CTAButton>

      </SplitSection>


        {/* Featured Products Section */}
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>


      {/* <FullWidthVideoSection
  title="How Bioteem 40 Works"
  description="A quick walkthrough of what makes our formula effective and how it supports gut balance every day."
  videoSrc="/assets/full-product-video.mp4"
  posterSrc="/assets/video-poster.jpg"
  captionsSrc="/assets/full-product-video.mp4"
  transcript="This video explains how Bioteem 40 supports digestive wellness..."
/> */} 

{/* Need to work on making thevideo work through a CDN or a youtube service */}

 <SplitSection
        eyebrow="Health"
        title="Good for the World, Good for You"
        body="Originally developed to help combat malnutrition in the developing world, this groundbreaking innovation has more than proven its value in North America and beyond. We’re challenging the norms around nutrient absorption and gut health to deliver a product that truly meets your needs."
        imageSrc="/assets/field-product-home.jpg"
        imageAlt="Bioteem products with coconuts on table in a field"
      >
       <CTAButton href="/about" variant="primary">
  Learn more about us
</CTAButton>

      </SplitSection>
    </>
  )
}
