import CTAButton from "@modules/common/components/call-to-action-btn"

export default function ContactPage() {
  return (
    <div className="content-container py-20">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h1 className="text-3xl font-semibold">Contact Us</h1>

        <p className="text-base text-gray-700">
          Have a question about our products, subscriptions, or anything else?
          Reach out and we’ll get back to you as soon as possible.
        </p>

        <div className="space-y-2 text-sm text-gray-600">
          <p>
            <span className="font-medium">Email:</span>{" "}
            <a
              href="mailto:support@yourdomain.com"
              className="underline hover:text-black"
            >
              support@yourdomain.com
            </a>
          </p>
          <p>
            <span className="font-medium">Hours:</span> Monday – Friday, 9am–5pm
          </p>
        </div>

        <CTAButton href="mailto:support@yourdomain.com?subject=Support%20Request">
          Email Us
        </CTAButton>
      </div>
    </div>
  )
}
