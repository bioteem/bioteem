"use client"

import { useState } from "react"
import { Heading } from "@medusajs/ui"
import CTAButton from "@modules/common/components/call-to-action-btn"
import MuxPlayer from "@mux/mux-player-react"

const PLAYBACK_ID = "cj6X00oNm01fVYgBK24HyXjvdbH8G01200Gf5vSD5Go7Fw4"

const Hero = () => {
  const [ended, setEnded] = useState(false)

  return (
    <section className="relative h-[75vh] w-full overflow-hidden border-b border-ui-border-base bg-ui-bg-subtle">
      {/* Video background */}
      <div className="absolute inset-0">
        <MuxPlayer
          playbackId={PLAYBACK_ID}
          streamType="on-demand"
          // Autoplay requirements
          autoPlay
          muted
          playsInline
          loop={false}
          // If your video has audio, keep controls hidden in hero
          controls={false}
          // Important for a hero background
          className="h-full w-full object-cover"
          style={{
            // Some versions of mux-player need explicit fit
            objectFit: "cover",
          }}
          // When it finishes, we show the blur + CTA overlay
          onEnded={() => setEnded(true)}
        />

        {/* Optional: subtle dark overlay while video plays for readability */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* When ended: blur + freeze-like feel + show content */}
      <div
        className={[
          "absolute inset-0 transition-opacity duration-500",
          ended ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        {/* blurred “frozen” overlay */}
        <div className="absolute inset-0 backdrop-blur-md bg-black/25" />
      </div>

      {/* Content (only show after video ends) */}
      <div className="relative z-10 flex h-full w-full items-center justify-center px-4">
        <div
          className={[
            "max-w-2xl text-center transition-all duration-500",
            ended ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
          ].join(" ")}
        >
          <div className="inline-flex flex-col gap-4 rounded-3xl">
            <Heading
              level="h1"
              className="text-3xl md:text-4xl leading-tight text-white font-normal"
            >
              Designed to Nourish
            </Heading>

            <div className="mt-4 flex justify-center">
              <CTAButton href="/store" variant="primary">
                Shop Now
              </CTAButton>
            </div>
          </div>
        </div>
      </div>

      {/* Optional: if you want the CTA visible immediately on slow connections,
          you can start ended=true after a timeout fallback. */}
    </section>
  )
}

export default Hero
