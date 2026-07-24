import { useState } from "react";
import { cn } from "@/lib/utils";
import { MarkdownViewer } from "./MarkdownViewer";

interface ExpandableTextProps {
  text: string;
  maxChars?: number; // Kept for API compatibility, though we rely more on length for the check
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
      <div className={className}>
        <MarkdownViewer content={text} />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 relative",
          !isExpanded && "max-h-[120px]",
        )}
      >
        <MarkdownViewer content={text} />
        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="mt-1 text-primary font-bold text-sm hover:underline inline-flex items-center focus:outline-none"
      >
        {isExpanded ? "عرض أقل" : "عرض المزيد"}
      </button>
    </div>
  );
}
