import React from "react"
import FounderHero from "@modules/about/components/founder-hero"

export default function AboutPage() {
  return (
    <div className="w-full">
      <FounderHero
        name="Dr. K"
        title="A message from our Founder"
        quote="Bioteem40 was inspired by my time in pediatric clinics in my home country of Uganda, where I saw firsthand how proper nutrition—and the ability to actually absorb it—can transform health outcomes. Bioteem was created to deliver complete, accessible nutrition through a probiotic-powered system designed for maximum absorption and truly effective supplementation.
 
        Bioteem40 continues to support better health outcomes here in Canada, across North America, and beyond—but our mission also remains rooted in Uganda and other resource-limited regions around the world. It is complete, accessible nutrition for all."
        imageSrc="/assets/founder.jpg"
        imageAlt="Portrait of the founder of Bioteem"
      />

    </div>
  )
  
}

