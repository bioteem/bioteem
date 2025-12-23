import CTAButton from "@modules/common/components/call-to-action-btn"

type ContactSectionProps = {
  title?: string
  description?: string
  email?: string
  phone?: string
  address?: string
  hours?: string
}

export function ContactSection({
  title = "Contact Us",
  description = "Have a question about our products, subscriptions, or anything else? Reach out and we’ll get back to you as soon as possible.",
  email = "info@bioteem40.ca",
  phone = "+1 (902) 306-4110",
  address = "93 Centennial Dr, Windsor, Nova Scotia, Canada B0N 2T0",
}: ContactSectionProps) {
  return (
    <div className="content-container py-20">
      <div className="mx-auto max-w-2xl text-center space-y-8">
        <h1 className="text-3xl font-semibold">{title}</h1>

        <p className="text-base text-gray-700">{description}</p>

        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <span className="font-medium">Email:</span>{" "}
            <a
              href={`mailto:${email}`}
              className="underline hover:text-black"
            >
              {email}
            </a>
          </p>

          <p>
            <span className="font-medium">Phone:</span>{" "}
            <a
              href={`tel:${phone}`}
              className="underline hover:text-black"
            >
              {phone}
            </a>
          </p>

          <p>
            <span className="font-medium">Address:</span> {address}
          </p>
        </div>

        <CTAButton href={`mailto:${email}?subject=Support%20Request`}>
          Email Us
        </CTAButton>
      </div>
    </div>
  )
}
