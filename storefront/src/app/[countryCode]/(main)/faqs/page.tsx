import Faq from "@modules/faqs/components/faq"

const FAQS = [
  { q: "What is Bioteem?", a: "Bioteem is a daily gut health supplement..." },
  { q: "When will my order ship?", a: "Orders typically ship in 1–2 business days." },
  { q: "Can I cancel my subscription?", a: "Yes—manage it anytime from your account." },
]

export default function FaqPage() {
  return (
    <div className="content-container py-12">
      <h1 className="text-3xl font-semibold text-ui-fg-base">FAQs</h1>
      <p className="mt-2 text-ui-fg-subtle max-w-2xl">
        Quick answers to common questions.
      </p>

      <div className="mt-10 max-w-3xl">
        <Faq items={FAQS} defaultValue="item-0" />
      </div>
    </div>
  )
}
