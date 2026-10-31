import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { apiAssetUrl } from "@/config/env"
import { initials } from "@/lib/format"

type UserAvatarProps = {
  name: string
  src: string | null | undefined
  size?: "default" | "sm" | "lg"
  className?: string
}

export function UserAvatar({
  name,
  src,
  size = "default",
  className,
}: UserAvatarProps) {
  return (
    <Avatar className={className} size={size}>
      <AvatarImage alt={name} src={apiAssetUrl(src)} />
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
