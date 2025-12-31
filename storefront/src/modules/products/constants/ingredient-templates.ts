export type IngredientTemplateId =
  | "general"
  | "skin"
  | "skin-liquid"
  | "general-liquid" // add more as needed

type IngredientTemplate = {
  title: string
  description?: string
  items: string[]
}

export const INGREDIENT_TEMPLATES: Record<IngredientTemplateId, IngredientTemplate> = {
  general: {
    title: "Key Ingredients",
    description:
      "",
    items: [
    "Other Ingredients: Active probiotic cultures, DHA algal oil, coconut milk powder, red marine algae, modified cornstarch, natural beet colourant, guar gum, gum arabic, lecithin, strawberry extract, stevia leaf extract",

"Autre Ingrédients: Cultures probiotiques actives, huile d'algue DHA, poudre de lait de coco, algue marine rouge (Lithothamnion calcareum), modifié amidon de maïs, colorant naturel de betterave, gomme guar, gomme arabique, lécithine, extrait de fraise, extrait de feuille de stévia."
   
    ],
  },
  skin: {
    title: "Key Ingredients",
    description:
      "",
    items: [
              "Other Ingredients: Active probiotic cultures, DHA algal oil, coconut milk powder, red marine algae, modified cornstarch, natural beet colourant, guar gum, gum arabic, lecithin, strawberry extract, stevia leaf extract",
      "Autre Ingrédients: Cultures probiotiques actives, huile d'algue DHA, poudre de lait de coco, algue marine rouge (Lithothamnion calcareum), modifié amidon de maïs, colorant naturel de betterave, gomme guar, gomme arabique, lécithine, extrait de fraise, extrait de feuille de stévia"
 ],
  },
  "skin-liquid": {
    title: "Key Ingredients",
    description:
      "",
    items: [
"Other Ingredients: Water, active probiotic cultures, DHA algal oil, coconut milk powder, red marine algae, cornstarch, natural beet colourant, xanthan gum, guar gum, gum arabic, lecithin, strawberry extract, stevia leaf extract",

"Autre Ingrédients: Eau, cultures probiotiques actives, huile d'algue DHA, poudre de lait de coco, algue marine rouge(Lithothamnion calcareum), amidon de maïs, colorant naturel de betterave, gomme xanthane, gomme guar, gomme arabique, lécithine, extrait de fraise, extrait de feuille de stévia"
    ],
  },
  "general-liquid": {
    title: "Key Ingredients",
    description:
      "",
    items: [
"Other Ingredients: Water, active probiotic cultures, DHA algal oil, coconut milk powder, red marine algae, cornstarch, natural beet colourant, xanthan gum, guar gum, gum arabic, lecithin, strawberry extract, stevia leaf extract",

"Autre Ingrédients: Eau, cultures probiotiques actives, huile d'algue DHA, poudre de lait de coco, algue marine rouge(Lithothamnion calcareum), amidon de maïs, colorant naturel de betterave, gomme xanthane, gomme guar, gomme arabique, lécithine, extrait de fraise, extrait de feuille de stévia"
    ],
  },
}