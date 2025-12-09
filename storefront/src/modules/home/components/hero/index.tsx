import Image from "next/image"
import Link from "next/link"
import { Button, Heading } from "@medusajs/ui"

const Hero = () => {
  return (
    <section className="relative h-[75vh] w-full overflow-hidden border-b border-ui-border-base bg-ui-bg-subtle">
      {/* Background image */}
      <Image
        src="/assets/hero-all.jpg" // put your image in /public/hero-bg.jpg
        alt="Bioteem background"
        fill
        priority
        className="object-cover"
      />

      {/* Slight dark overlay to boost contrast */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Content */}
      <div className="relative z-10 flex h-full w-full items-center justify-center px-4">
        <div className="max-w-2xl text-center">
          {/* Blurred card behind text */}
          <div className="inline-flex flex-col gap-4 rounded-3xl bg-ui-bg-subtle/60 px-8 py-6 backdrop-blur-md">
            <Heading
              level="h1"
              className="text-3xl md:text-4xl leading-tight text-ui-fg-base font-normal"
            >
              Designed to Nourish
            </Heading>
            {/* <Heading
              level="h2"
              className="text-base md:text-lg text-ui-fg-subtle font-normal"
            >
              Daily probiotic support tailored for your gut and lifestyle.
            </Heading> */}

            <div className="mt-4 flex justify-center">
              <Link href="/store">
                <Button size="large" variant="primary">
                  Shop now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero