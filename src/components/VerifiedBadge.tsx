import { BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function VerifiedBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 shrink-0 rounded-full bg-blue-500/10 border border-blue-400/30 px-1.5 py-0">
          <BadgeCheck
            className={
              size === "sm"
                ? "w-3 h-3 text-blue-500 fill-blue-500/20"
                : "w-4 h-4 text-blue-500 fill-blue-500/20"
            }
            aria-label="حساب موثّق"
          />
          <span className={`font-bold ${size === "sm" ? "text-[9px]" : "text-[10px]"} text-blue-600 dark:text-blue-400`}>
            موثق
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>حساب موثّق</TooltipContent>
    </Tooltip>
  );
}
