import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const MENTION_REGEX_TIPTAP = /\[@\s+id="([^"]+)"\s+label="([^"]+)"\]/g;
const MENTION_REGEX_LEGACY = /\[@([^\]]+)\]\(([^)]+)\)/g;

export const renderMarkdownContent = (content: string, className?: string) => {
  const transformedContent = content
    .replace(MENTION_REGEX_TIPTAP, '[$2](/profile/$1)')
    .replace(MENTION_REGEX_LEGACY, '[$1](/profile/$2)');

  return (
    <div className={cn("markdown-body", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            if (href?.startsWith("/profile/")) {
              const profileId = href.replace("/profile/", "");
              return (
                <Link
                  to="/profile/$id"
                  params={{ id: profileId } as never}
                  className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-semibold hover:underline inline-flex items-center gap-1"
                >
                  {children}
                </Link>
              );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" {...props}>{children}</a>;
          },
        }}
      >
        {transformedContent}
      </ReactMarkdown>
    </div>
  );
};
