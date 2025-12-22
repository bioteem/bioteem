import React from "react"
import { Button } from "@medusajs/ui"
import Link from "next/link"

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
    <Link href={href}>
    <Button
      size={size}
      asChild
      className={`${variantClasses[variant]} ${className}`}
    >
     {children}
    </Button></Link>
  )
}

export default CTAButton
