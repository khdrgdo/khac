import { cn } from "@/lib/utils";

interface NexusLogoProps {
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showTagline?: boolean;
  taglineText?: string;
  className?: string;
}

/**
 * Modern geometric "N" lettermark icon.
 * Serves as the brand logo for NEXUS.
 */
export function NexusIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
    >
      <defs>
        <linearGradient id="nexus-n-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E1B4B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="nexus-n-letter" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect
        width="32"
        height="32"
        rx="8"
        fill="url(#nexus-n-bg)"
        stroke="rgba(139, 92, 246, 0.35)"
        strokeWidth="1"
      />
      {/* Precision geometric capital letter 'N' */}
      <path
        d="M8.5 8.5H12L19.5 20.2V8.5H23.5V23.5H20L12.5 11.8V23.5H8.5V8.5Z"
        fill="url(#nexus-n-letter)"
      />
    </svg>
  );
}

/**
 * Premium Typography Wordmark: "NEXUS"
 * Strictly adheres to exact brand spelling: N - E - X - U - S (Always Left-To-Right)
 * Clean geometric typography, exact baseline alignment, perfect tracking.
 * Letter "X" features a refined purple accent (#8B5CF6) for brand identity.
 */
export function NexusWordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const textSizeClasses = {
    sm: "text-base sm:text-lg tracking-[0.22em]",
    md: "text-xl sm:text-2xl tracking-[0.25em]",
    lg: "text-3xl sm:text-4xl tracking-[0.28em]",
  };

  return (
    <span
      dir="ltr"
      lang="en"
      className={cn(
        "inline-flex flex-row items-baseline font-sans font-black uppercase select-none leading-none tracking-[0.25em] [direction:ltr] [flex-direction:row]",
        textSizeClasses[size],
        className,
      )}
      style={{ direction: "ltr", unicodeBidi: "isolate", flexDirection: "row" }}
    >
      <span className="text-foreground font-black">N</span>
      <span className="text-foreground font-black">E</span>
      <span className="text-[#8B5CF6] font-black transition-colors duration-200">X</span>
      <span className="text-foreground font-black">U</span>
      <span className="text-foreground font-black">S</span>
    </span>
  );
}

export function NexusLogo({
  size = "md",
  showIcon = true,
  showTagline = true,
  taglineText = "المنصة الأكاديمية الذكية",
  className,
}: NexusLogoProps) {
  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-10 h-10",
  };

  return (
    <div
      dir="ltr"
      className={cn(
        "inline-flex flex-row items-center gap-2.5 select-none [direction:ltr] [flex-direction:row]",
        className,
      )}
      style={{ direction: "ltr", unicodeBidi: "isolate", flexDirection: "row" }}
    >
      {showIcon && (
        <div className="shrink-0 flex items-center justify-center">
          <NexusIcon className={iconSizes[size]} />
        </div>
      )}

      <div
        dir="ltr"
        className="flex flex-col justify-center items-start [direction:ltr]"
        style={{ direction: "ltr", textAlign: "left" }}
      >
        <NexusWordmark size={size} />
        {showTagline && taglineText && (
          <span
            dir="rtl"
            className="text-[10px] font-semibold text-muted-foreground/80 leading-none mt-1 flex items-center gap-1.5 [direction:rtl]"
            style={{ direction: "rtl" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] shrink-0" />
            <span>{taglineText}</span>
          </span>
        )}
      </div>
    </div>
  );
}
