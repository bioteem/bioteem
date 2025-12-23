import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function TopNavLinks() {
  return (
    <div className="border-b bg-white">
      <div className="content-container flex items-center justify-center gap-x-8 h-12 text-sm">
        <LocalizedClientLink href="/store">Shop</LocalizedClientLink>
        <LocalizedClientLink href="/about">About</LocalizedClientLink>
        <LocalizedClientLink href="/subscriptions">Subscriptions</LocalizedClientLink>
        <LocalizedClientLink href="/blog">Blog</LocalizedClientLink>
        <LocalizedClientLink href="/contact">Contact</LocalizedClientLink>
      </div>
    </div>
  )
}
