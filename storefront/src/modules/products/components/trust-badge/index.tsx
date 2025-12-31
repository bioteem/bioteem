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
 <svg width="23" height="24" viewBox="0 0 23 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M11.3073 0L9.09673 3.91968C9.05079 3.98718 8.97486 4.03312 8.89704 4.03312C8.85673 4.03312 6.49608 2.73186 6.49608 2.73186L7.90234 8.88186C7.91359 8.91374 7.91359 8.93999 7.91359 8.97093C7.91359 9.19311 7.73078 9.36841 7.51704 9.36841C7.40641 9.36841 7.3061 9.32247 7.23485 9.25591L4.73069 6.34687L3.77256 8.04655C3.721 8.10843 3.6385 8.16187 3.54756 8.16187C3.53443 8.16187 0.404998 7.5478 0.404998 7.5478C0.404998 7.5478 1.47281 10.9236 1.47281 10.9575C1.47281 11.0644 1.41187 11.16 1.32374 11.2115L0 11.97L5.7384 16.5329C5.79184 16.5872 5.8209 16.6576 5.8209 16.7363C5.8209 16.7738 5.21622 19.1232 5.21622 19.1232C5.21622 19.1232 10.2788 18.0751 10.3013 18.0751C10.4907 18.0751 10.651 18.2382 10.651 18.4313L10.546 23.9494H12.0723L11.9767 18.4313C11.9767 18.2373 12.1304 18.0751 12.3235 18.0751C12.3441 18.0751 17.4058 19.1232 17.4058 19.1232C17.4058 19.1232 16.7964 16.7738 16.7964 16.7363C16.7964 16.6585 16.8301 16.5873 16.8817 16.5329L22.6201 11.97L21.2973 11.2115C21.2082 11.16 21.1501 11.0644 21.1501 10.9575C21.1501 10.9237 22.216 7.5478 22.216 7.5478C22.216 7.5478 19.0912 8.16187 19.0802 8.16187C18.9789 8.16187 18.9039 8.10843 18.8486 8.04655L17.8896 6.34687L15.3883 9.25687C15.3114 9.32343 15.2148 9.36937 15.1042 9.36937C14.8886 9.36937 14.7058 9.19406 14.7058 8.97189C14.7058 8.94001 16.1252 2.73188 16.1252 2.73188C16.1252 2.73188 13.7655 4.03314 13.728 4.03314C13.6455 4.03314 13.5677 3.9872 13.5273 3.9197L11.3073 0Z" fill="#FF001B"/>
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