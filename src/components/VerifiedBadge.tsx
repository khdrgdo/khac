import { BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function VerifiedBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <BadgeCheck
          className={
            size === "sm"
              ? "w-3.5 h-3.5 text-primary fill-primary/20 shrink-0"
              : "w-5 h-5 text-primary fill-primary/20 shrink-0"
          }
          aria-label="حساب موثّق"
        />
      </TooltipTrigger>
      <TooltipContent>حساب موثّق</TooltipContent>
    </Tooltip>
  );
}
