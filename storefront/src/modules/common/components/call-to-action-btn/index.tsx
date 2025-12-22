import React from "react"
import { Button } from "@medusajs/ui"
import Link from "next/link"

type CTAButtonProps = {
  href: string
  children: React.ReactNode
  className?: string
  size?: "base" | "small" | "large" | "xlarge"
  variant?: "primary" | "secondary"
}

const variantClasses = {
  primary: "bg-[#005198] hover:bg-[#034c8c] text-white",
  secondary: "border border-black text-black hover:bg-black hover:text-white",
} as const

const CTAButton = ({
  href,
  children,
  variant = "primary",
  size = "large",
  className = "",
}: CTAButtonProps) => {
  return (
    <Button
      size={size}
      asChild
      className={`${variantClasses[variant]} ${className}`}
    >
      <Link href={href}>{children}</Link>
    </Button>
  )
}

export default CTAButton
