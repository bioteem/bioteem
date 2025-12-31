"use client"

import { CheckCircleSolid } from "@medusajs/icons"

type Props = {
  satisfactionText?: string
  madeInText?: string
  className?: string
}

export default function TrustBadges({
  satisfactionText = "100% Satisfaction Guaranteed",
  madeInText = "Made in Canada",
  className = "",
}: Props) {

  function CheckIcon() {
  return (
    <CheckCircleSolid color="#04db2f" />
  )
}

function MapleLeafIcon() {
  return (
   <svg width="25pt" height="25pt" version="1.1" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg">
 <path d="m49.992 0.10547-9.2109 16.332c-0.19141 0.28125-0.50781 0.47266-0.83203 0.47266-0.16797 0-10.004-5.4219-10.004-5.4219l5.8594 25.625c0.046874 0.13281 0.046874 0.24219 0.046874 0.37109 0 0.92578-0.76172 1.6562-1.6523 1.6562-0.46094 0-0.87891-0.19141-1.1758-0.46875l-10.434-12.121-3.9922 7.082c-0.21484 0.25781-0.55859 0.48047-0.9375 0.48047-0.054687 0-13.094-2.5586-13.094-2.5586s4.4492 14.066 4.4492 14.207c0 0.44531-0.25391 0.84375-0.62109 1.0586l-5.5156 3.1602 23.91 19.012c0.22266 0.22656 0.34375 0.51953 0.34375 0.84766 0 0.15625-2.5195 9.9453-2.5195 9.9453s21.094-4.3672 21.188-4.3672c0.78906 0 1.457 0.67969 1.457 1.4844l-0.4375 22.992h6.3594l-0.39844-22.992c0-0.80859 0.64062-1.4844 1.4453-1.4844 0.085938 0 21.176 4.3672 21.176 4.3672s-2.5391-9.7891-2.5391-9.9453c0-0.32422 0.14062-0.62109 0.35547-0.84766l23.91-19.012-5.5117-3.1602c-0.37109-0.21484-0.61328-0.61328-0.61328-1.0586 0-0.14062 4.4414-14.207 4.4414-14.207s-13.02 2.5586-13.066 2.5586c-0.42188 0-0.73438-0.22266-0.96484-0.48047l-3.9961-7.082-10.422 12.125c-0.32031 0.27734-0.72266 0.46875-1.1836 0.46875-0.89844 0-1.6602-0.73047-1.6602-1.6562 0-0.13281 5.9141-26 5.9141-26s-9.832 5.4219-9.9883 5.4219c-0.34375 0-0.66797-0.19141-0.83594-0.47266l-9.25-16.332" fill="#ff001b"/>
</svg>
  )
}
  return (
    <div
      className={[
        "",
        className,
      ].join(" ")}
    >
      <Badge icon={<CheckIcon />} text={satisfactionText} />
      <Badge icon={<MapleLeafIcon/>} text={madeInText} />
    </div>
  )
}

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-[#005198]">{icon}</span>
      <span className="text-sm font-medium text-gray-900">{text}</span>
    </div>
  )
}