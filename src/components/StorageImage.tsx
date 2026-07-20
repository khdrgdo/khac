import { useQuery } from "@tanstack/react-query";
import { signedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

interface Props {
  bucket: string;
  path: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}

export function StorageImage({ bucket, path, alt, className, fallback }: Props) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    queryFn: () => signedUrl(bucket, path, 3600),
  });

  if (!path) return fallback ? <>{fallback}</> : null;
  if (isLoading || !url) {
    return (
      <div
        className={cn(
          "bg-muted animate-pulse flex items-center justify-center text-muted-foreground",
          className,
        )}
      >
        <ImageIcon className="w-6 h-6" />
      </div>
    );
  }

  return <img src={url} alt={alt ?? ""} className={className} loading="lazy" />;
}
