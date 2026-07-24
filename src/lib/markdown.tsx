import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export const renderMarkdownContent = (content: string, className?: string) => {
  // Replace mentions like [@username](userId) with [@username](/profile/userId)
  const transformedContent = content.replace(/\[@([^\]]+)\]\(([^)]+)\)/g, '[@$1](/profile/$2)');

  return (
    <div className={cn("markdown-body", className)}>
      <ReactMarkdown
        components={{
          a: ({ href, children, ...props }) => {
            if (href?.startsWith("/profile/")) {
              return <Link to={href as any} className="text-primary font-semibold hover:underline" {...props}>{children}</Link>;
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
