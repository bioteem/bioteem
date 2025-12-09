export type IngredientTemplateId =
  | "general"
  | "skin"
  | "gut"
  | "energy" // add more as needed

type IngredientTemplate = {
  title: string
  description?: string
  items: string[]
}

export const INGREDIENT_TEMPLATES: Record<IngredientTemplateId, IngredientTemplate> = {
  general: {
    title: "Key Ingredients",
    description:
      "A balanced blend designed for daily foundational support.",
    items: [
      "Lactobacillus rhamnosus – supports overall gut balance",
      "Bifidobacterium longum – helps maintain a healthy microbiome",
      "Inulin (prebiotic fiber) – nourishes beneficial bacteria",
    ],
  },
  skin: {
    title: "Skin-Focused Ingredients",
    description:
      "Formulated to support skin clarity, barrier function, and hydration from within.",
    items: [
      "Lactobacillus rhamnosus GG – associated with improved skin barrier",
      "Lactobacillus paracasei – supports skin comfort and resilience",
      "Zinc – contributes to the maintenance of normal skin",
      "Vitamin C – supports collagen formation and antioxidant protection",
    ],
  },
  gut: {
    title: "Gut Health Blend",
    description:
      "Strains chosen to support digestion, regularity, and microbial diversity.",
    items: [
      "Lactobacillus plantarum – supports digestion and gas reduction",
      "Bifidobacterium breve – associated with gut comfort",
      "Fructooligosaccharides (FOS) – prebiotic for beneficial microbes",
    ],
  },
  energy: {
    title: "Energy & Mood Support",
    description:
      "Designed to gently support energy production and mood balance.",
    items: [
      "B vitamins (B6, B9, B12) – support normal energy-yielding metabolism",
      "Magnesium – contributes to the reduction of tiredness and fatigue",
      "Lactobacillus helveticus – explored in mood and stress research",
    ],
  },
}