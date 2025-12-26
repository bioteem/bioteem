import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { TooltipProvider } from "@medusajs/ui"
import "styles/globals.css"
// in (main)/(checkout) layouts
export const fetchCache = "default-no-store"
export const revalidate = 0
export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <body>
         <TooltipProvider>
        <main className="relative">{props.children}</main>
        </TooltipProvider>
      </body>
    </html>
  )
}
