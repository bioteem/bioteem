import React from "react"
import { Button } from "@medusajs/ui"

type CTAButtonProps = {
  href: string
  children: React.ReactNode
  className?: string
  size?: "base" | "small" | "large" | "xlarge"
}

type Variant = "primary" | "secondary"

const variantClasses: Record<Variant, string> = {
  primary: "bg-[#005198] hover:bg-[#034c8c] text-white",
  secondary: "border border-black text-black hover:bg-black hover:text-white",
}

const CTAButton = ({
  href,
  children,
  variant = "primary",
  size = "large",
  className = "",
}: CTAButtonProps & { variant?: Variant }) => {
  return (
    <Button
      size={size}
      asChild
      className={`${variantClasses[variant]} ${className}`}
    >
      <a href={href}>{children}</a>
    </Button>
  )
}

export default CTAButton
