"use client"

import { Heading, Text } from "@medusajs/ui"
import MuxPlayer from "@mux/mux-player-react"

type FullWidthMuxVideoSectionProps = {
  title?: string
  description?: string

  /** Mux Playback ID (e.g. "cj6X00oN...") */
  playbackId: string

  /** Optional poster time (seconds) used for poster + fallback thumbnail */
  posterTime?: number

  /** Optional: show native-like player controls */
  showControls?: boolean

  /** Optional transcript */
  transcript?: string
}

const FullWidthVideoSection = ({
  title,
  description,
  playbackId,
  posterTime = 0,
  showControls = true,
  transcript,
}: FullWidthMuxVideoSectionProps) => {
  const posterUrl = `https://image.mux.com/${playbackId}/thumbnail.webp?time=${posterTime}`

  return (
    <section className="w-full bg-ui-bg-subtle py-12 md:py-16">
      {/* Optional Text Above */}
      {(title || description) && (
        <div className="mx-auto mb-8 max-w-4xl space-y-3 px-4 text-center">
          {title && (
            <Heading
              level="h2"
              className="text-2xl md:text-3xl text-ui-fg-base font-normal"
            >
              {title}
            </Heading>
          )}
          {description && (
            <Text className="text-sm md:text-base text-ui-fg-subtle leading-relaxed">
              {description}
            </Text>
          )}
        </div>
      )}

      {/* Full-width Mux video */}
      <div className="w-full">
        <MuxPlayer
          playbackId={playbackId}
          streamType="on-demand"
          preload="metadata"
          playsInline
          
          // If you want autoplay, pass autoPlay+muted from parent or extend props
          poster={posterUrl}
          className="w-full"
          style={{
            width: "100%",
            height: "auto",
            aspectRatio: "16 / 9", // change if your video isn't 16:9
          }}
          aria-describedby={transcript ? "video-transcript" : undefined}
        />
      </div>

      {/* Optional transcript */}
      {transcript && (
        <div className="mx-auto max-w-4xl px-4 pt-6">
          <details className="text-xs md:text-sm text-ui-fg-subtle">
            <summary className="cursor-pointer text-ui-fg-muted">
              Show transcript
            </summary>
            <p id="video-transcript" className="mt-2 leading-relaxed">
              {transcript}
            </p>
          </details>
        </div>
      )}
    </section>
  )
}

export default FullWidthVideoSection
