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
    "Other Ingredients: Active probiotic cultures, DHA algal oil, coconut milk powder, red marine algae, modified cornstarch, natural beet colourant, guar gum, gum arabic, lecithin, strawberry extract, stevia leaf extract",

"Autre Ingrédients: Cultures probiotiques actives, huile d'algue DHA, poudre de lait de coco, algue marine rouge (Lithothamnion calcareum), modifié amidon de maïs, colorant naturel de betterave, gomme guar, gomme arabique, lécithine, extrait de fraise, extrait de feuille de stévia."
   
    ],
  },
  skin: {
    title: "Skin-Focused Ingredients",
    description:
      "Formulated to support skin clarity, barrier function, and hydration from within.",
    items: [
              "Other Ingredients: Active probiotic cultures, DHA algal oil, coconut milk powder, red marine algae, modified cornstarch, natural beet colourant, guar gum, gum arabic, lecithin, strawberry extract, stevia leaf extract",
      "Autre Ingrédients: Cultures probiotiques actives, huile d'algue DHA, poudre de lait de coco, algue marine rouge (Lithothamnion calcareum), modifié amidon de maïs, colorant naturel de betterave, gomme guar, gomme arabique, lécithine, extrait de fraise, extrait de feuille de stévia"
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