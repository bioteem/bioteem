"use client"

import { useEffect, useState } from "react"
import { Heading } from "@medusajs/ui"
import CTAButton from "@modules/common/components/call-to-action-btn"
import { MuxBackgroundVideo } from "@mux/mux-background-video/react"

const PLAYBACK_ID = "cj6X00oNm01fVYgBK24HyXjvdbH8G01200Gf5vSD5Go7Fw4"

const Hero = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Server-safe fallback (prevents hydration error)
    return (
      <section className="h-[60vh] sm:h-[65vh] lg:h-[75vh] bg-black" />
    )
  }

  const streamSrc = `https://stream.mux.com/${PLAYBACK_ID}.m3u8`
  const posterSrc = `https://image.mux.com/${PLAYBACK_ID}/thumbnail.webp?time=0`

  return (
    <section className="relative w-full overflow-hidden bg-black h-[60vh] sm:h-[65vh] lg:h-[75vh]">
      <div className="absolute inset-0">
        <MuxBackgroundVideo
          src={streamSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
        >
          <img
            src={posterSrc}
            alt="Bioteem hero background"
            className="h-full w-full object-cover"
          />
        </MuxBackgroundVideo>
      </div>

      <div className="absolute inset-0 backdrop-blur-md bg-black/25" />

      <div className="relative z-20 flex h-full items-center justify-center px-6">
        <div className="text-center">
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
