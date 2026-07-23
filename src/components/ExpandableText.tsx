import { useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  maxChars?: number;
  maxLines?: number;
  className?: string;
}

export function ExpandableText({
  text,
  maxChars = 240,
  maxLines = 3,
  className,
}: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  const lines = text.split("\n");
  const isLong = text.length > maxChars || lines.length > maxLines;

  if (!isLong) {
    return (
      <p className={cn("whitespace-pre-wrap text-[15px] leading-relaxed", className)}>{text}</p>
    );
  }

  let truncated = text;
  if (!isExpanded) {
    if (lines.length > maxLines) {
      truncated = lines.slice(0, maxLines).join("\n");
    }
    if (truncated.length > maxChars) {
      truncated = truncated.slice(0, maxChars);
    }
  }

  return (
    <p className={cn("whitespace-pre-wrap text-[15px] leading-relaxed", className)}>
      {isExpanded ? (
        <>
          {text}{" "}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(false);
            }}
            className="text-primary font-bold text-xs hover:underline ms-1.5 inline-flex items-center text-primary/90 focus:outline-none"
          >
            عرض أقل
          </button>
        </>
      ) : (
        <>
          {truncated.trimEnd()}
          <span className="text-muted-foreground">... </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className="text-primary font-bold text-xs sm:text-sm hover:underline ms-1 inline-flex items-center hover:text-primary/80 focus:outline-none"
          >
            عرض المزيد
          </button>
        </>
      )}
    </p>
  );
}
