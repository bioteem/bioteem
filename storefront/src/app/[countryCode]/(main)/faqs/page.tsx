import Faq from "@modules/faqs/components/faq"

const ProductQuality = [
  {
    q: "What is the expiration date? Why does it say best before date and what is the difference?",
    a: "Our liquid products are dated with a 4-month expiration from the date of manufacture. Fresh product is made weekly. Our liquid products are stamped with a 12-week Best Before date, which is the date on which the product should be consumed to ensure the highest product quality. Best-before dates are used to indicate that the concentrations of ingredients remain at those levels. Expiration dates are dates on which the product should be discarded. Our powder products are much more stable and are stamped with 2-year Best Before dates."
  },
  {
    q: "I noticed the colour of the liquid product slightly fades by the end of my 1-month supply, is this normal?",
    a: "Yes. We only use naturally sourced ingredients in our products. Small amounts of beet juice are used to give the products a red colour. Beyond the best-before dates, product colour may fade, but the quality and safety are guaranteed."
  },
  {
    q: "The product consistency is thicker than usual, is this normal?",
    a: "If the product is left in the fridge for long periods without use, it may thicken. Simply shake the product to regain the desired consistency."
  },
  {
    q: "I left my liquid product out of the fridge overnight, is it safe to consume?",
    a: "Our liquid products are intended to be refrigerated at 4°C. However, being left out of the fridge for a few hours should be fine. Use your discretion — if the product starts to bloat or tastes off, discard it. We also recommend refrigerating powder tubs after opening. If powder is left out of the fridge, it is still safe to consume; simply refrigerate it as soon as possible to maintain freshness. Travel Packs never require refrigeration."
  }
]

const Shipping = [
  {
    q: "How long does the product take to ship to me? Is the product safe upon arrival?",
    a: "Within certain geographical areas, we offer next-day shipping (24 hours), though some transit times may be longer. All liquid shipments are refrigerated using high-quality, recyclable paper insulation with frozen gel packs. Upon delivery, liquid products should be cool to the touch, not warm. If a product does not arrive cool, we will issue a replacement shipment. Please see our shipping policy for more details."
  },
  {
    q: "The product arrived later than the expected delivery date, is it safe to consume?",
    a: "If there are delays in transit and the product arrives beyond the expected delivery date, we will issue a replacement shipment at the next available shipping time. Please refer to our shipping policy for further information."
  },
  {
    q: "What are your shipping costs?",
    a: "For non-refrigerated products, we charge a flat rate of $5 per order. If refrigerated products are included in an order, a fixed shipping rate is calculated at checkout per one-month supply and is based on your geographical location."
  }
]
const ProductSafety = [
  {
    q: "Is the product safe to consume while pregnant or breastfeeding?",
    a: "Yes. Our products are safe to consume while pregnant or breastfeeding as long as you do not exceed the recommended daily servings. We recommend consulting your physician before starting any new supplement regimen, especially if you are already taking a prenatal vitamin, to ensure supplemented quantities do not exceed the recommended daily dose."
  },
  {
    q: "Can I take this product with other supplements?",
    a: "Depending on the supplements, yes. Always check with your healthcare provider or one of our Customer Service Representatives if you have any questions."
  },
  {
    q: "Can I take this product with prescription medications?",
    a: "Yes. However, it is best to check with your healthcare provider."
  },
  {
    q: "Can I drink more than the daily recommended servings?",
    a: "Although not normally necessary, if you feel you need an extra boost you may consume more than the recommended serving. Our products contain ingredient concentrations that are safe to consume ad libitum, or as desired."
  },
  {
    q: "Does this product affect hormone levels?",
    a: "We have not specifically studied hormone interactions with this product. However, there have been no customer concerns or indications of hormone interference based on supporting literature for the product ingredients."
  }
]

const ProductEfficacy = [
  {
    q: "How long should I take this product before I see results?",
    a: "Results vary depending on the consumer’s underlying health, diet, and lifestyle. Some individuals have experienced relief from IBS, rosacea, or skin issues within the first week of use. With most supplements, it may take a few weeks to see meaningful results. We recommend a 30-day product use challenge to properly gauge effectiveness."
  },
  {
    q: "I have skin issues like eczema, how quickly before I see results?",
    a: "Some consumers have reported relief in as little as one week. We recommend trying the 30-day product challenge to fully assess your results."
  },
  {
    q: "Can this product help with IBS?",
    a: "We have seen notable improvements among individuals with IBS who use our products. They contain anti-inflammatory ingredients, fibre, and probiotics to help manage IBS symptoms. Probiotic use has been shown to improve transit times, reduce the number of daily bowel movements, and improve stool consistency. We encourage you to review our IBS testimonials and try the product for yourself."
  },
  {
    q: "Can this product help with weight loss?",
    a: "Some probiotic strains have been documented to support weight management when used consistently over a period of 6–8 weeks. While this is not a specific claim, individual results may vary."
  },
  {
    q: "Can this product help with menstrual pains and cramps?",
    a: "Although this has not been specifically studied, we have received customer reviews indicating relief from menstrual pain and cramps."
  },
  {
    q: "Can this product help with my energy levels?",
    a: "Yes. Probiotics support digestion, which can make energy from food more readily available. In addition, our products provide bioactive ingredients that support normal metabolic function."
  },
  {
    q: "When should I take Bioteem?",
    a: "There is no single wrong time to take Bioteem. Our team prefers morning use to support digestion and energy throughout the day, and the fibre content may help promote fullness and satisfaction. That said, taking it about an hour before bed can also be beneficial, as probiotics may support overnight digestion and plant-based magnesium may help promote restful sleep."
  }
]
const General = [
  {
    q: "Where can I find a list of specific vitamins and concentrations?",
    a: "Product ingredients and concentrations can be found on the Supplemented Facts Table on the product labels, or on our website under View Nutritional Information."
  },
  {
    q: "Can I take other vitamins that are not found in your product?",
    a: "Yes. We do not provide every vitamin or mineral required for specific health needs. If your healthcare provider has suggested additional vitamins (such as B12), you may supplement our products with your own vitamins."
  },
  {
    q: "I noticed I was gassy and bloated the first few days, is this normal?",
    a: "Yes. First-time probiotic users may experience bloating, gas, or increased regularity within the first few days. This is normal as probiotics re-establish themselves in the gut. We recommend starting with a half dose to help ease your body into the probiotic blend."
  },
  {
    q: "What is the source of your Magnesium and Calcium?",
    a: "Our magnesium and calcium are sourced from a high-potency marine alga that naturally bioaccumulates these minerals. They are present in their elemental forms, which may improve bioavailability and absorption."
  },
  {
    q: "Is this product vegan?",
    a: "We use marine hydrolyzed collagen in our Skin & Anti-aging formula. Our General Health formula does not contain animal-derived products."
  },
  {
    q: "Is this product lactose-free?",
    a: "Yes. Our products are fermented from coconut milk and do not contain lactose."
  },
  {
    q: "What do you use as a sweetener?",
    a: "We use small amounts of stevia, sourced from the Stevia rebaudiana plant, also known as Sweetleaf or Sugarleaf."
  },
  {
    q: "Why do you use cornstarch? Is it the same as high fructose corn syrup (HFCS)?",
    a: "Cornstarch is one of our hydrocolloid components and helps keep ingredients in solution while providing a pleasant mouthfeel. Cornstarch is not high fructose corn syrup. HFCS is a further processed derivative of cornstarch."
  },
  {
    q: "Can I use your product receipts for the Disability Tax Credit for Irritable Bowel Syndrome (IBS)?",
    a: "Yes. Please stay tuned for more details in our monthly newsletter."
  },
  {
    q: "Is this product gluten-free?",
    a: "Yes. All of our products are gluten-free."
  },
  {
    q: "What do you use to achieve the strawberry flavour?",
    a: "We use a natural strawberry extract. If you have a strawberry allergy, please note that the extract may contain trace proteins that can trigger allergic reactions. We recommend requesting a sample before use if you have known allergies. Please contact us through our contact page to request a single-serving sample."
  },
  {
    q: "How do you colour your product?",
    a: "We use beet extract to achieve the pinkish hue in our strawberry-flavoured probiotics."
  }
]


export default function FaqPage() {
  return (
    <div className="content-container py-12">
      <h1 className="text-3xl font-semibold text-ui-fg-base">FAQs</h1>
      <p className="mt-2 text-ui-fg-subtle max-w-2xl">
        You have questions, We Have answers
      </p>

      <div className="mt-10 max-w-3xl">
        <h1>Product Quality</h1>
        <Faq items={ProductQuality}></Faq>
      </div>
      <div className="mt-10 max-w-3xl">
        <h1>Shipping</h1>
        <Faq items={Shipping}></Faq>
      </div>
      <div className="mt-10 max-w-3xl">
        <h1>Product Safety</h1>
        <Faq items={ProductSafety}></Faq>
      </div>
      <div className="mt-10 max-w-3xl">
        <h1>Product Efficacy</h1>
        <Faq items={ProductSafety}></Faq>
      </div>
       <div className="mt-10 max-w-3xl">
        <h1>General Questions</h1>
        <Faq items={ProductSafety}></Faq>
      </div>
    </div>
  )
}
