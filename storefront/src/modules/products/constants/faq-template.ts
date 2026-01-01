export type FaqItem = {
  q: string
  a: string
}

export type FaqTemplateMap = Record<string, FaqItem[]>

export const FAQ_TEMPLATES: FaqTemplateMap = {
  general: [
    {q:"Will this help with constipation?", a:"For many of our customers, the answer is a very enthusiastic yes. Let’s just say—we’re #1 when it comes to #2. Our therapeutic blend of 30+ probiotic strains and prebiotic fibre works together to help keep things moving smoothly. Better poops await."},

{q:"How can I expect to feel?",a:"After 30 days, customers often report fewer digestive issues, more energy, clearer thinking, and better sleep. Your results may vary, but we’re pretty excited to hear how you feel."},

{q:"How much should I take?",a:"Our recommended serving is one scoop or shot daily. That said, some folks prefer to start with a half serving and work their way up. With so many potent probiotics packed in, your gut may need a few days to say hello to its new friends."},

{q:"How do I take it?", a:"Our liquid is great consumed on its own, and the powder is wonderful added into any cool beverage or smoothies (shake well!)"}
  ],

  skin: [
   {q:"Will this help with fine lines and wrinkles?", a:"That’s the plan! This formula includes marine collagen peptides, zinc, copper, and essential amino acids to stimulate collagen production—plus high-quality omega-3s from algae. All designed to support healthy, radiant skin from the inside out."},

{q:"Can this help with eczema, rosacea, or psoriasis?", a:"We’ve had many happy customers report improvements in symptoms associated with these conditions after using our Skin Health formula. While individual results vary, we love hearing these kinds of success stories!"},

{q:"If I want immune support, do I need to take this and the General Health formula?", a :"Nope :) The Skin Health formula is built on the same base as our General Health & Immune Support blend—so you’re getting all the immune and digestive benefits plus targeted support for skin, hair, nails, and connective tissue."},

{q:"How much should I take?", a:"Our recommended serving is one scoop or shot daily. That said, some folks prefer to start with a half serving and work their way up. With so many potent probiotics packed in, your gut may need a few days to say hello to its new friends."},

{q:"How do I take it?", a:"Our liquid is great consumed on its own, and the powder is wonderful added into any cool beverage or smoothies (shake well!)"}
  ],
}