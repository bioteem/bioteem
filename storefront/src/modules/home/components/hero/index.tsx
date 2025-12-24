"use client"

import { useEffect, useState } from "react"
import CTAButton from "@modules/common/components/call-to-action-btn"
import { MuxBackgroundVideo } from '@mux/mux-background-video/react';
import { Heading } from "@medusajs/ui"

export default function Hero() {
  const [showOverlay, setShowOverlay] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setShowOverlay(true), 1100) // match your intro duration
    return () => window.clearTimeout(t)
  }, [])

  return (
    <section className="relative h-[75vh] w-full overflow-hidden bg-black">
      <MuxBackgroundVideo
        src="https://stream.mux.com/cj6X00oNm01fVYgBK24HyXjvdbH8G01200Gf5vSD5Go7Fw4.m3u8"
      >
        <img
          src="https://image.mux.com/cj6X00oNm01fVYgBK24HyXjvdbH8G01200Gf5vSD5Go7Fw4/thumbnail.webp?time=0"
          alt="Bioteem hero"
          className="h-full w-full object-cover"
        />
      </MuxBackgroundVideo>

      {/* Always keep a subtle overlay for readability */}
      <div className="absolute inset-0 bg-black/15" />

      {/* Blur + CTA appears after timer */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          showOverlay ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 backdrop-blur-md bg-black/25" />
      </div>

      <div className="relative z-10 flex h-full items-center justify-center px-6">
        <div
          className={`text-center transition-all duration-500 ${
            showOverlay
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          <Heading level="h1" className="text-3xl md:text-4xl font-normal text-white">
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
