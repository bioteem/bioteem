import React from "react"
import SplitSection from "@modules/layout/components/split"

export default function AboutPage() {
  return (
    <div className="w-full">
       <SplitSection
              title="A message from our Founder"
        body="Bioteem40 was inspired by my time in pediatric clinics in my home country of Uganda, where I saw firsthand how proper nutrition—and the ability to actually absorb it—can transform health outcomes. Bioteem was created to deliver complete, accessible nutrition through a probiotic-powered system designed for maximum absorption and truly effective supplementation.
 
        Bioteem40 continues to support better health outcomes here in Canada, across North America, and beyond—but our mission also remains rooted in Uganda and other resource-limited regions around the world. It is complete, accessible nutrition for all."
        imageSrc="/assets/founder.jpg"
        imageAlt="Portrait of the founder of Bioteem"
        quoteAuthor="Dr.K, Founder"
                variant="portrait"
        blockquote></SplitSection>

        <SplitSection
        title="Our Science"
        body="We’ve developed what we call a “biological onion”—layers upon layers of micronutrients wrapped together at a molecular level. These layers are delivered by powerful, diverse probiotics to the place your body needs them most: your gut.

Bioteem is designed to prepare your gut first, balancing your microbiome with a potent blend of probiotics and prebiotic fibre. This allows your body to fully absorb the layered “onion” of nutrients that, thanks to our proprietary technology, arrives in your gut intact and ready to be put to work where it matters most."
        imageSrc="/assets/our-science.jpg"
        imageAlt="Bioteem Products with the powder form beneath it."
        variant="stacked"
        
        >
        </SplitSection>
    </div>
  )
  
}

