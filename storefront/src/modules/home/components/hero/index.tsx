"use client"

import { useState } from "react"
import { Heading } from "@medusajs/ui"
import CTAButton from "@modules/common/components/call-to-action-btn"
import MuxPlayer from "@mux/mux-player-react"

const PLAYBACK_ID = "cj6X00oNm01fVYgBK24HyXjvdbH8G01200Gf5vSD5Go7Fw4"

const Hero = () => {
  const [ended, setEnded] = useState(false)

  return (
    <section className="relative w-full overflow-hidden bg-black h-[60vh] sm:h-[65vh] lg:h-[75vh]">
      {/* Background video layer */}
      <div className="absolute inset-0 overflow-hidden">
        <MuxPlayer
          playbackId={PLAYBACK_ID}
          streamType="on-demand"
          autoPlay
          muted
          playsInline
          loop={false}
          preload="auto"
          onEnded={() => setEnded(true)}
          // Make it a background layer and crop edges by scaling
          className="absolute inset-0 z-0 h-full w-full pointer-events-none
                     scale-[1.12] sm:scale-[1.16] lg:scale-[1.22]"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Contrast overlay */}
      <div className="absolute z-10 inset-0 bg-black/20" />

      {/* Blur overlay after video ends */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          ended ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 backdrop-blur-md bg-black/25" />
      </div>

      {/* Content */}
      <div className="relative z-20 flex h-full items-center justify-center px-6">
        <div
          className={`text-center transition-all duration-500 ${
            ended
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          <Heading
            level="h1"
            className="text-3xl md:text-4xl font-normal text-white"
          >
            Designed to Nourish
          </Heading>

          <div className="mt-6 flex justify-center">
            <CTAButton href="/store" variant="primary">
              Shop Now
            </CTAButton>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
