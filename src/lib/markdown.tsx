import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const MENTION_SPAN_REGEX = /<span\b([^>]*?)data-type="mention"([^>]*?)>([^<]*)<\/span>/gi;

function convertMentionHtml(content: string): string {
  return content.replace(MENTION_SPAN_REGEX, (_full, before: string, after: string, text: string) => {
    const tagContent = before + after;
    const idMatch = tagContent.match(/data-id="([^"]*)"/);
    const id = idMatch?.[1] ?? "";
    const name = text.replace(/^@/, "").trim() || id;
    return `[${name}](/profile/${id})`;
  });
}

export const renderMarkdownContent = (content: string, className?: string) => {
  const transformedContent = convertMentionHtml(content);

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
