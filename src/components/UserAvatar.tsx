import { useQuery } from "@tanstack/react-query";
import { signedUrl } from "@/lib/storage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  avatarUrl: string | null | undefined;
  fullName: string;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({ avatarUrl, fullName, className, fallbackClassName }: UserAvatarProps) {
  const { data: url } = useQuery({
    queryKey: ["signed-avatar-url", avatarUrl],
    enabled: !!avatarUrl && !avatarUrl.startsWith("http"),
    staleTime: 15 * 60 * 1000, // 15 mins cache
    queryFn: () => signedUrl("avatars", avatarUrl, 1800),
  });

  const finalUrl = avatarUrl?.startsWith("http") ? avatarUrl : (url ?? undefined);

  return (
    <Avatar className={cn("w-10 h-10 shrink-0", className)}>
      <AvatarImage src={finalUrl} alt={fullName} referrerPolicy="no-referrer" />
      <AvatarFallback className={cn("bg-primary/10 text-primary font-semibold", fallbackClassName)}>
        {fullName ? fullName.slice(0, 2) : "؟"}
      </AvatarFallback>
    </Avatar>
  );
}
