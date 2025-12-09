"use client"

import { Heading, Text } from "@medusajs/ui"

type FullWidthVideoSectionProps = {
  title?: string
  description?: string
  videoSrc: string
  posterSrc: string
  captionsSrc?: string
  transcript?: string
}

const FullWidthVideoSection = ({
  title,
  description,
  videoSrc,
  posterSrc,
  captionsSrc,
  transcript,
}: FullWidthVideoSectionProps) => {
  return (
    <section className="w-full bg-ui-bg-subtle py-12 md:py-16">
      {/* Optional Text Above */}
      {(title || description) && (
        <div className="mx-auto max-w-4xl px-4 text-center mb-8 space-y-3">
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

      {/* Full-width video */}
      <div className="w-full">
        <video
          className="w-full h-auto object-cover"
          src={videoSrc}
          poster={posterSrc}
          controls
          playsInline
          preload="metadata"
          aria-describedby="video-transcript"
        >
          {captionsSrc && (
            <track
              kind="captions"
              src={captionsSrc}
              srcLang="en"
              label="English captions"
              default
            />
          )}
        </video>
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