"use client"



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
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function MapleLeafIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2l1.2 4.2L17 4l-1 4 4 1-3.4 2.4L19 15l-4-1-1 4-2-3.2L10 18l-1-4-4 1 2.4-3.6L4 9l4-1-1-4 3.8 2.2L12 2z" />
    </svg>
  )
}
  return (
    <div
      className={[
        "flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center",
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