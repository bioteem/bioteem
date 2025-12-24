// src/modules/products/constants/triple-info-templates.ts

export type TripleInfoTemplateId =
  | "general"
  | "skin"

export type TripleInfoItem = {
  text: string
  highlight?: boolean
}

export type TripleInfoColumn = {
  title: string
  items: TripleInfoItem[]
  footerKey?: "cdhf" | "none"
}

export type TripleInfoTemplate = {
  columns: [TripleInfoColumn, TripleInfoColumn, TripleInfoColumn]
}

export const TRIPLE_INFO_TEMPLATES: Record<
  TripleInfoTemplateId,
  TripleInfoTemplate
> = {
  general: {
    columns: [
      {
        title: "Benefits",
        items: [
          { text: "Provides the body with foundational nutrition" },
          { text: "Supports a healthy microbiome" },
          { text: "Improves immune resilience" },
        ],
        footerKey: "cdhf",
      },
      {
        title: "Why It Works",
        items: [
          { text: "Over 30 probiotic strains" },
          { text: "20 billion CFU per serving" },
          { text: "Clinically studied ingredients" },
        ],
      },
      {
        title: "All In One Serving",
        items: [
          { text: "6 Probiotic capsules" },
          { text: "2 Omega-3 capsules" },
          { text: "2 Antioxidant capsules" },
        ],
      },
    ],
  },

  skin: {
    columns: [
      {
        title: "Benefits",
        items: [
          { text: "Supports skin clarity and hydration", highlight: true },
          {
            text: "Soothes eczema, rosacea & psoriasis symptoms",
            highlight: true,
          },
          { text: "Strengthens the gut–skin axis" },
        ],
        footerKey: "cdhf",
      },
      {
        title: "Why It Works",
        items: [
          { text: "Marine collagen peptides", highlight: true },
          { text: "Targeted skin-supporting probiotics" },
          { text: "Microencapsulated for bioavailability" },
        ],
      },
      {
        title: "All In One Serving",
        items: [
          { text: "6 Probiotic capsules" },
          { text: "10 Collagen capsules" },
          { text: "2 Zinc capsules" },
        ],
      },
    ],
  }
}
