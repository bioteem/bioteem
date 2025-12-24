"use client"

import { useState } from "react"
import { Heading } from "@medusajs/ui"
import CTAButton from "@modules/common/components/call-to-action-btn"
import MuxPlayer from "@mux/mux-player-react"

const PLAYBACK_ID = "cj6X00oNm01fVYgBK24HyXjvdbH8G01200Gf5vSD5Go7Fw4"

const Hero = () => {
  const [ended, setEnded] = useState(false)

  return (
    <section className="relative h-[75vh] w-full overflow-hidden bg-black">
      {/* Video background */}
      <MuxPlayer
        playbackId={PLAYBACK_ID}
        streamType="on-demand"
        autoPlay
        muted
        playsInline
        loop={false}
        preload="auto"
        onEnded={() => setEnded(true)}
        className="absolute inset-0 h-full w-full mux-no-controls pointer-events-none"
        style={{
          objectFit: "cover", // 🔑 removes black bars
        }}
      />

      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Blur overlay after video ends */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          ended ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 backdrop-blur-md bg-black/25" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full items-center justify-center px-6">
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
