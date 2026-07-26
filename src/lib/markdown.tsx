import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export const renderMarkdownContent = (content: string, className?: string) => {
  const transformedContent = content.replace(/\[@([^\]]+)\]\(([^)]+)\)/g, '[@$1](/profile/$2)');

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
                  params={{ id: profileId }}
                  className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-semibold hover:underline inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
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
