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
          { text: "Effective relief of symptoms related to IBS, indigestion, acid reflux, GERD, and Colitis" },
          {text:"Sustained energy through better digestion"},
          {text:"Promotes better sleep"},
          {text:"Supports mental clarity"},
          {text:"Increased immune function"}
        ],
        footerKey: "cdhf",
      },
      {
        title: "Why It Works",
        items: [
          {text:"Replaces 30+ dietary supplement capsules.", highlight:true} ,
          {text : "Over 30+ bacterial strains for a healthy gut ﬂora"},
{text : "20 billion CFU per serving"},
{text : "Algae Sourced Omega lipids to support normal body metabolism"},
{text : "Antioxidants to support cellular function and oxidative repair"},
{text : "Vitamins, minerals, and co-factors to support enzymatic activity"},
{text : "Essential amino acids for daily body nourishment"},
{text : "Protective microencapsulation for sustained release and availability"},
{text : "Fortified with Aquamin™ Multi-Mineral Complex"},
{text : "Gluten and Lactose Free"}
        ],
      },
      {
        title: "All In One Serving",
        items: [
          {text:"6 Probiotic capsules"},
{text:"2 Omega3 capsules"},
{text:"2 Anti‐Oxidant capsules"},
{text:"1 Calcium capsule"},
{text:"1 Magnesium capsule"},
{text:"3 micronutrient capsules"},
{text:"1 Vitamin A capsule"},
{text:"2 Vitamin B capsules"},
{text:"4 Vitamin C capsules"},
{text:"5 Vitamin D capsules"},
{text:"2 Vitamin E capsules"},
{text:"1 Bioflavonoid capsule"}
        ],
      },
    ],
  },

  skin: {
    columns: [
      {
        title: "Benefits",
        items: [
          { text: "Provides the body with foundational nutrition"},
{ text: "Supports Healthy Microbiome"},
{ text: "Soothe symptoms related to IBS, indigestion, acid reflux, GERD, and Colitis"},
{ text: "Sustained energy through better digestion"},
{ text: "Promotes better sleep"},
{ text: "Supports mental clarity"},
{ text: "Increased immune function"},
{ text: "Skin Clarity"},
{ text: "Soothe symptoms related to eczema, rosacea & psoriasis",highlight:true},
{ text: "Improve skin hydration and fine lines",highlight:true},
{ text: "Improve hair growth",highlight:true},
        ],
        footerKey: "cdhf",
      },
      {
        title: "Why It Works",
        items: [
          { text: "8 synergistic bioactives to support repair and maintain skin",highlight:true},
{ text: "Over 30+ bacterial strains for a healthy gut ﬂora"},
{ text: "20 billion CFU per serving"},
{ text: "Algae Sourced Omega lipids to support normal body metabolism"},
{ text: "Antioxidants to support cellular function and oxidative repair"},
{ text: "Vitamins, minerals, and co-factors to support enzymatic activity"},
{ text: "Essential amino acids for daily body nourishment"},
{ text: "Protective microencapsulation for sustained release and availability"},
{ text: "Fortified with Aquamin ™ Multi-Mineral Complex"},
{ text: "Gluten and Lactose Free"},
{ text: "Type 1 Marine Collagen Peptides",highlight:true},
{ text: "7 precursors that encourage natural collagen production of 28 required types of collagen from within",highlight:true},
        ],
      },
      {
        title: "All In One Serving",
        items: [
            {text:"6 Probiotic capsules"},
{text:"2 Omega3 capsules"},
{text:"2 Anti‐Oxidant capsules"},
{text:"1 Calcium capsule"},
{text:"1 Magnesium capsule"},
{text:"3 micronutrient capsules"},
{text:"1 Vitamin A capsule"},
{text:"2 Vitamin B capsules"},
{text:"4 Vitamin C capsules"},
{text:"5 Vitamin D capsules"},
{text:"2 Vitamin E capsules"},
{text:"1 Bioflavonoid capsule"},
{text:"10 Collagen capsules"},
{text:"2 Zinc capsules"},
{text:"2 Glycine capsules"},
{text:"2 Lysine capsules"},
        ],
      },
    ],
  }
}
