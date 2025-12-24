"use client"

import { useState } from "react"
import { Heading } from "@medusajs/ui"
import CTAButton from "@modules/common/components/call-to-action-btn"
import MuxPlayer from "@mux/mux-player-react"

import { MuxBackgroundVideo } from '@mux/mux-background-video/react';

const PLAYBACK_ID = "cj6X00oNm01fVYgBK24HyXjvdbH8G01200Gf5vSD5Go7Fw4"

const Hero = () => {
  const [ended, setEnded] = useState(false)

  return (
    <section className="relative w-full overflow-hidden bg-black h-[60vh] sm:h-[65vh] lg:h-[75vh]">

       <MuxBackgroundVideo src="https://stream.mux.com/cj6X00oNm01fVYgBK24HyXjvdbH8G01200Gf5vSD5Go7Fw4.m3u8">
      <img src="https://image.mux.com/cj6X00oNm01fVYgBK24HyXjvdbH8G01200Gf5vSD5Go7Fw4/thumbnail.webp?time=0" alt="Mux Background Video" />
    </MuxBackgroundVideo>
      {/* Blur overlay after video ends */}
      <div
        className="absolute inset-0 transition-opacity duration-500 
          opacity-100"
        
      >
        <div className="absolute inset-0 backdrop-blur-md bg-black/25" />
      </div>

      {/* Content */}
      <div className="relative z-20 flex h-full items-center justify-center px-6">
        <div
          className="text-center transition-all duration-500 opacity-100 translate-y-0"

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
