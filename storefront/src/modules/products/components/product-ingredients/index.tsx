import { HttpTypes } from "@medusajs/types"
import {
  INGREDIENT_TEMPLATES,
  type IngredientTemplateId,
} from "@modules/products/constants/ingredient-templates"

type ProductIngredientsProps = {
  product: HttpTypes.StoreProduct
}

/**
 * Chooses an ingredient template based on product.metadata.ingredient_template
 *
 * In Admin → Product → Metadata, set:
 *   Key: ingredient_template
 *   Value: one of "general", "skin", "gut", "energy", etc.
 */
const ProductIngredients: React.FC<ProductIngredientsProps> = ({ product }) => {
  const templateKey = product.metadata?.ingredient_template as
    | IngredientTemplateId
    | undefined

  if (!templateKey) {
    return null
  }

  const template = INGREDIENT_TEMPLATES[templateKey]

  if (!template) {
    // Unknown key → render nothing to avoid breaking the page
    return null
  }

  const { title, description, items } = template

  if (!items?.length) {
    return null
  }

  return (
    <section className="mt-6">
      <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-ui-fg-muted mb-2">
        {title}
      </h3>

      {description && (
        <p className="mb-2 text-xs text-ui-fg-subtle leading-relaxed">
          {description}
        </p>
      )}

      <ul className="list-disc pl-5 space-y-1 text-sm text-ui-fg-subtle">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export default ProductIngredients